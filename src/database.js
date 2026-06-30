import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import sql from "mssql/msnodesqlv8.js";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const databaseName = process.env.DB_NAME || "CybertagShop";

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME may contain only letters, digits and underscores");
}

const defaultConnection = (name) =>
  `Driver={ODBC Driver 17 for SQL Server};Server=localhost\\SQLEXPRESS;Database=${name};Trusted_Connection=yes;TrustServerCertificate=yes;`;

const appConnectionString = process.env.DB_CONNECTION_STRING || defaultConnection(databaseName);
const masterConnectionString = process.env.DB_MASTER_CONNECTION_STRING || defaultConnection("master");

let poolPromise;

const createPool = (connectionString) => new sql.ConnectionPool({
  connectionString,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
});

const splitBatches = (source) => source
  .split(/^\s*GO\s*$/gim)
  .map((batch) => batch.trim())
  .filter(Boolean);

const executeFile = async (pool, filename) => {
  const source = await fs.readFile(path.join(rootDir, "sql", filename), "utf8");
  for (const batch of splitBatches(source)) {
    await pool.request().query(batch);
  }
};

export const getPool = async () => {
  if (!poolPromise) {
    poolPromise = createPool(appConnectionString).connect();
  }
  return poolPromise;
};

export const closePool = async () => {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = undefined;
  await pool.close();
};

const seedDemoUser = async (pool) => {
  if (process.env.SEED_DEMO_USER === "0") return;

  const password = process.env.DEMO_ADMIN_PASSWORD || "cybertag2026";
  const passwordHash = await bcrypt.hash(password, 12);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const existing = await new sql.Request(transaction)
      .input("login", sql.NVarChar(50), "manager")
      .query("SELECT UserId FROM dbo.Users WHERE Login = @login");

    if (!existing.recordset.length) {
      const customer = await new sql.Request(transaction)
        .input("fullName", sql.NVarChar(200), "Менеджер CYBERTAG")
        .input("email", sql.NVarChar(254), "manager@cybertag.local")
        .query(`
          INSERT INTO dbo.Customers (FullName, Email)
          OUTPUT inserted.CustomerId
          VALUES (@fullName, @email)
        `);

      await new sql.Request(transaction)
        .input("login", sql.NVarChar(50), "manager")
        .input("passwordHash", sql.NVarChar(100), passwordHash)
        .input("customerId", sql.Int, customer.recordset[0].CustomerId)
        .query(`
          INSERT INTO dbo.Users (Login, PasswordHash, Role, CustomerId)
          VALUES (@login, @passwordHash, N'admin', @customerId)
        `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const initializeDatabase = async () => {
  const masterPool = await createPool(masterConnectionString).connect();
  try {
    await masterPool.request().query(`
      IF DB_ID(N'${databaseName}') IS NULL
        CREATE DATABASE [${databaseName}];
    `);
  } finally {
    await masterPool.close();
  }

  const pool = await getPool();
  await executeFile(pool, "01_Schema.sql");
  await executeFile(pool, "02_Objects.sql");
  await executeFile(pool, "03_SeedData.sql");
  await seedDemoUser(pool);
  return pool;
};

export const registerUser = async ({ fullName, username, email, passwordHash }) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const duplicate = await new sql.Request(transaction)
      .input("login", sql.NVarChar(50), username)
      .input("email", sql.NVarChar(254), email)
      .query(`
        SELECT u.Login, c.Email
        FROM dbo.Users AS u
        LEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId
        WHERE u.Login = @login OR c.Email = @email
      `);

    if (duplicate.recordset.length) {
      const error = new Error("Пользователь с таким логином или email уже существует.");
      error.code = "DUPLICATE_USER";
      throw error;
    }

    const customer = await new sql.Request(transaction)
      .input("fullName", sql.NVarChar(200), fullName)
      .input("email", sql.NVarChar(254), email)
      .query(`
        INSERT INTO dbo.Customers (FullName, Email)
        OUTPUT inserted.CustomerId
        VALUES (@fullName, @email)
      `);

    const user = await new sql.Request(transaction)
      .input("login", sql.NVarChar(50), username)
      .input("passwordHash", sql.NVarChar(100), passwordHash)
      .input("role", sql.NVarChar(20), "customer")
      .input("customerId", sql.Int, customer.recordset[0].CustomerId)
      .execute("dbo.pr_RegisterUser");

    await transaction.commit();
    return {
      id: user.recordset[0].UserId,
      username: user.recordset[0].Login,
      role: user.recordset[0].Role,
      name: fullName,
      email,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const findUserByIdentity = async (identity) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("identity", sql.NVarChar(254), identity)
    .query(`
      SELECT u.UserId, u.Login, u.PasswordHash, u.Role, u.IsActive,
             c.FullName, c.Email
      FROM dbo.Users AS u
      LEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId
      WHERE u.Login = @identity OR c.Email = @identity
    `);
  return result.recordset[0] || null;
};

export const markLogin = async (userId) => {
  const pool = await getPool();
  await pool.request()
    .input("userId", sql.Int, userId)
    .query("UPDATE dbo.Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId");
};

export const createSession = async ({ userId, tokenHash, expiresAt }) => {
  const pool = await getPool();
  await pool.request().query("DELETE FROM dbo.Sessions WHERE ExpiresAt <= SYSUTCDATETIME()");
  await pool.request()
    .input("userId", sql.Int, userId)
    .input("tokenHash", sql.Char(64), tokenHash)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.Sessions (UserId, TokenHash, ExpiresAt)
      VALUES (@userId, @tokenHash, @expiresAt)
    `);
};

export const getUserBySession = async (tokenHash) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .query(`
      SELECT u.UserId, u.Login, u.Role, c.FullName, c.Email
      FROM dbo.Sessions AS s
      INNER JOIN dbo.Users AS u ON u.UserId = s.UserId
      LEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId
      WHERE s.TokenHash = @tokenHash
        AND s.ExpiresAt > SYSUTCDATETIME()
        AND u.IsActive = 1
    `);

  if (!result.recordset.length) return null;

  await pool.request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .query("UPDATE dbo.Sessions SET LastSeenAt = SYSUTCDATETIME() WHERE TokenHash = @tokenHash");

  const row = result.recordset[0];
  return { id: row.UserId, username: row.Login, role: row.Role, name: row.FullName, email: row.Email };
};

export const deleteSession = async (tokenHash) => {
  if (!tokenHash) return;
  const pool = await getPool();
  await pool.request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .query("DELETE FROM dbo.Sessions WHERE TokenHash = @tokenHash");
};

const mapPromotion = (row) => ({
  id: row.PromotionId,
  title: row.Title,
  text: row.Description,
  date: row.DateLabel,
  image: row.ImageUrl,
  active: Boolean(row.IsActive),
  createdAt: row.CreatedAt,
});

export const listPromotions = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT PromotionId, Title, Description, DateLabel, ImageUrl, IsActive, CreatedAt
    FROM dbo.Promotions
    WHERE IsActive = 1
    ORDER BY CreatedAt DESC, PromotionId DESC
  `);
  return result.recordset.map(mapPromotion);
};

export const createPromotion = async ({ title, description, dateLabel, imageUrl, userId }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("title", sql.NVarChar(160), title)
    .input("description", sql.NVarChar(1000), description)
    .input("dateLabel", sql.NVarChar(120), dateLabel)
    .input("imageUrl", sql.NVarChar(500), imageUrl)
    .input("userId", sql.Int, userId)
    .query(`
      INSERT INTO dbo.Promotions (Title, Description, DateLabel, ImageUrl, CreatedByUserId)
      OUTPUT inserted.PromotionId, inserted.Title, inserted.Description, inserted.DateLabel,
             inserted.ImageUrl, inserted.IsActive, inserted.CreatedAt
      VALUES (@title, @description, @dateLabel, @imageUrl, @userId)
    `);
  return mapPromotion(result.recordset[0]);
};

export const createOrderForUser = async ({ userId, items }) => {
  const groupedItems = new Map();
  for (const item of items) {
    const title = String(item?.title || "").trim();
    const qty = Math.max(1, Math.min(20, Number(item?.qty) || 1));
    if (title) groupedItems.set(title, Math.min(20, (groupedItems.get(title) || 0) + qty));
  }

  if (!groupedItems.size || groupedItems.size > 20) {
    const error = new Error("Корзина не содержит допустимых товаров.");
    error.code = "INVALID_ORDER_ITEMS";
    throw error;
  }

  const pool = await getPool();
  const customer = await pool.request()
    .input("userId", sql.Int, userId)
    .query("SELECT CustomerId FROM dbo.Users WHERE UserId = @userId AND IsActive = 1");

  const customerId = customer.recordset[0]?.CustomerId;
  if (!customerId) {
    const error = new Error("Для пользователя не найден профиль клиента.");
    error.code = "CUSTOMER_NOT_FOUND";
    throw error;
  }

  const productRequest = pool.request();
  const parameters = Array.from(groupedItems.keys()).map((title, index) => {
    const name = `title${index}`;
    productRequest.input(name, sql.NVarChar(200), title);
    return `@${name}`;
  });
  const products = await productRequest.query(`
    SELECT ProductId, ProductName
    FROM dbo.Products
    WHERE IsActive = 1 AND ProductName IN (${parameters.join(", ")})
  `);

  if (products.recordset.length !== groupedItems.size) {
    const error = new Error("Один или несколько товаров больше недоступны.");
    error.code = "INVALID_ORDER_ITEMS";
    throw error;
  }

  const itemsJson = JSON.stringify(products.recordset.map((product) => ({
    productId: product.ProductId,
    qty: groupedItems.get(product.ProductName),
  })));
  const result = await pool.request()
    .input("customerId", sql.Int, customerId)
    .input("itemsJson", sql.NVarChar(sql.MAX), itemsJson)
    .execute("dbo.pr_CreateOrder");

  const order = result.recordset[0];
  return {
    id: order.OrderId,
    status: order.Status,
    totalAmount: Number(order.TotalAmount),
    orderDate: order.OrderDate,
  };
};

export const listAdminOrders = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT o.OrderId, o.OrderDate, o.Status, o.TotalAmount,
           c.FullName, c.Email,
           COALESCE(SUM(oi.Qty), 0) AS ItemCount,
           COALESCE(
             STRING_AGG(CAST(CONCAT(p.ProductName, N' × ', oi.Qty) AS NVARCHAR(MAX)), N', '),
             N''
           ) AS Items
    FROM dbo.Orders AS o
    INNER JOIN dbo.Customers AS c ON c.CustomerId = o.CustomerId
    LEFT JOIN dbo.OrderItems AS oi ON oi.OrderId = o.OrderId
    LEFT JOIN dbo.Products AS p ON p.ProductId = oi.ProductId
    GROUP BY o.OrderId, o.OrderDate, o.Status, o.TotalAmount, c.FullName, c.Email
    ORDER BY o.OrderDate DESC, o.OrderId DESC
  `);
  return result.recordset.map((row) => ({
    id: row.OrderId,
    orderDate: row.OrderDate,
    status: row.Status,
    totalAmount: Number(row.TotalAmount),
    customerName: row.FullName,
    customerEmail: row.Email,
    itemCount: Number(row.ItemCount),
    items: row.Items,
  }));
};

export const updateOrderStatus = async ({ orderId, status }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("orderId", sql.Int, orderId)
    .input("status", sql.NVarChar(20), status)
    .query(`
      UPDATE dbo.Orders
      SET Status = @status
      OUTPUT inserted.OrderId, inserted.Status
      WHERE OrderId = @orderId
    `);
  const row = result.recordset[0];
  return row ? { id: row.OrderId, status: row.Status } : null;
};

export const getDatabaseStats = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Users) AS Users,
      (SELECT COUNT(*) FROM dbo.Sessions WHERE ExpiresAt > SYSUTCDATETIME()) AS ActiveSessions,
      (SELECT COUNT(*) FROM dbo.Products) AS Products,
      (SELECT COUNT(*) FROM dbo.Orders) AS Orders,
      (SELECT COUNT(*) FROM dbo.Promotions WHERE IsActive = 1) AS Promotions
  `);
  return result.recordset[0];
};

export { sql, databaseName };

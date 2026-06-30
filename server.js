import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import {
  createOrderForUser,
  createPromotion,
  createSession,
  deactivatePromotion,
  deleteSession,
  findUserByIdentity,
  getDatabaseStats,
  getUserBySession,
  initializeDatabase,
  listAdminOrders,
  listPromotions,
  markLogin,
  registerUser,
  updateOrderStatus,
} from "./src/database.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sessionCookie = "cybertag_session";
const sessionDays = Math.max(1, Number(process.env.SESSION_DAYS || 7));
const sessionMaxAge = sessionDays * 24 * 60 * 60 * 1000;
const orderStatuses = new Set(["new", "processing", "shipped", "done", "cancelled"]);

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: user.role,
});

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "1",
  maxAge: sessionMaxAge,
  path: "/",
});

const setSession = async (res, userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAge);
  await createSession({ userId, tokenHash: hashToken(token), expiresAt });
  res.cookie(sessionCookie, token, cookieOptions());
};

const sessionUser = async (req) => {
  const token = req.cookies[sessionCookie];
  return token ? getUserBySession(hashToken(token)) : null;
};

const requireUser = async (req, res, next) => {
  try {
    const user = await sessionUser(req);
    if (!user) return res.status(401).json({ error: "Требуется авторизация." });
    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await sessionUser(req);
    if (!user) return res.status(401).json({ error: "Требуется авторизация." });
    if (user.role !== "admin") return res.status(403).json({ error: "Недостаточно прав." });
    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const protectAdminPage = async (req, res, next) => {
  try {
    const user = await sessionUser(req);
    if (!user) return res.redirect("/login/?next=admin");
    if (user.role !== "admin") return res.redirect("/");
    return next();
  } catch (error) {
    return next(error);
  }
};

const validateRegistration = ({ fullName, username, email, password }) => {
  if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) {
    return "Укажите имя длиной от 2 до 100 символов.";
  }
  if (typeof username !== "string" || !/^[A-Za-zА-Яа-яЁё0-9_.-]{3,32}$/.test(username.trim())) {
    return "Логин должен содержать от 3 до 32 букв, цифр, точек, дефисов или подчёркиваний.";
  }
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Укажите корректный email.";
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return "Пароль должен содержать от 8 до 128 символов.";
  }
  return null;
};

export const createApp = async () => {
  await initializeDatabase();

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Слишком много попыток. Повторите позже." },
  });

  app.get("/api/health", async (_req, res, next) => {
    try {
      res.json({ status: "ok", database: "Microsoft SQL Server", stats: await getDatabaseStats() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/promotions", async (_req, res, next) => {
    try {
      res.json({ promotions: await listPromotions() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", async (req, res, next) => {
    try {
      const user = await sessionUser(req);
      res.json({ user: user ? publicUser(user) : null });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
    try {
      const fullName = String(req.body.fullName || "").trim();
      const username = String(req.body.username || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const validationError = validateRegistration({ fullName, username, email, password });
      if (validationError) return res.status(400).json({ error: validationError });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await registerUser({ fullName, username, email, passwordHash });
      await setSession(res, user.id);
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === "DUPLICATE_USER" || error.number === 2627 || error.number === 2601) {
        return res.status(409).json({ error: "Пользователь с таким логином или email уже существует." });
      }
      return next(error);
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
    try {
      const identity = String(req.body.identity || "").trim();
      const password = String(req.body.password || "");
      const row = identity ? await findUserByIdentity(identity) : null;
      const valid = row && row.IsActive && await bcrypt.compare(password, row.PasswordHash);
      if (!valid) return res.status(401).json({ error: "Неверный логин, email или пароль." });

      const user = {
        id: row.UserId,
        username: row.Login,
        role: row.Role,
        name: row.FullName,
        email: row.Email,
      };
      await markLogin(user.id);
      await setSession(res, user.id);
      return res.json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      const token = req.cookies[sessionCookie];
      if (token) await deleteSession(hashToken(token));
      res.clearCookie(sessionCookie, { ...cookieOptions(), maxAge: undefined });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/orders", requireUser, async (req, res, next) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const order = await createOrderForUser({ userId: req.authUser.id, items });
      return res.status(201).json({ order });
    } catch (error) {
      if (error.code === "INVALID_ORDER_ITEMS" || error.code === "CUSTOMER_NOT_FOUND") {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    }
  });

  app.get("/api/admin/orders", requireAdmin, async (_req, res, next) => {
    try {
      res.json({ orders: await listAdminOrders() });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/orders/:orderId/status", requireAdmin, async (req, res, next) => {
    try {
      const orderId = Number(req.params.orderId);
      const status = String(req.body.status || "").trim();
      if (!Number.isInteger(orderId) || orderId < 1 || !orderStatuses.has(status)) {
        return res.status(400).json({ error: "Некорректный номер заказа или статус." });
      }
      const order = await updateOrderStatus({ orderId, status });
      if (!order) return res.status(404).json({ error: "Заказ не найден." });
      return res.json({ order });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/admin/promotions", requireAdmin, async (req, res, next) => {
    try {
      const title = String(req.body.title || "").trim();
      const description = String(req.body.description || "").trim();
      const dateLabel = String(req.body.dateLabel || "").trim();
      const imageUrl = String(req.body.imageUrl || "assets/offer-crm.jpg").trim();
      const imageIsAllowed = /^assets\/[A-Za-z0-9._/-]+$/.test(imageUrl) || /^https:\/\//i.test(imageUrl);

      if (title.length < 3 || title.length > 160) {
        return res.status(400).json({ error: "Название акции должно содержать от 3 до 160 символов." });
      }
      if (description.length < 10 || description.length > 1000) {
        return res.status(400).json({ error: "Описание акции должно содержать от 10 до 1000 символов." });
      }
      if (dateLabel.length < 2 || dateLabel.length > 120) {
        return res.status(400).json({ error: "Укажите срок действия акции." });
      }
      if (!imageIsAllowed || imageUrl.length > 500) {
        return res.status(400).json({ error: "Укажите HTTPS-ссылку или путь к изображению из assets/." });
      }

      const promotion = await createPromotion({
        title,
        description,
        dateLabel,
        imageUrl,
        userId: req.authUser.id,
      });
      return res.status(201).json({ promotion });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/promotions/:promotionId", requireAdmin, async (req, res, next) => {
    try {
      const promotionId = Number(req.params.promotionId);
      if (!Number.isInteger(promotionId) || promotionId < 1) {
        return res.status(400).json({ error: "Некорректный номер акции." });
      }
      const deletedId = await deactivatePromotion(promotionId);
      if (!deletedId) return res.status(404).json({ error: "Акция не найдена." });
      return res.json({ promotion: { id: deletedId, active: false } });
    } catch (error) {
      return next(error);
    }
  });

  app.get(["/admin", "/admin/", "/admin/index.html"], protectAdminPage, (_req, res) => {
    res.sendFile(path.join(rootDir, "admin", "index.html"));
  });

  app.use((req, res, next) => {
    if (/^\/(?:src|sql|scripts|tests|node_modules)(?:\/|$)/i.test(req.path)
      || /^\/(?:package(?:-lock)?\.json|server\.js|\.env)/i.test(req.path)) {
      return res.status(404).end();
    }
    return next();
  });

  app.use(express.static(rootDir, { dotfiles: "deny", index: "index.html", extensions: ["html"] }));

  app.use((error, req, res, _next) => {
    console.error(error);
    if (req.path.startsWith("/api/")) {
      res.status(500).json({ error: "Ошибка сервера. Повторите попытку позже." });
      return;
    }
    res.status(500).send("Internal server error");
  });

  return app;
};

export const startServer = async (port = Number(process.env.PORT || 3000)) => {
  const app = await createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === "object" ? address.port : port;
      console.log(`CYBERTAG server: http://127.0.0.1:${actualPort}`);
      resolve(server);
    });
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Categories
  (
    CategoryId INT IDENTITY(1,1) CONSTRAINT PK_Categories PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL CONSTRAINT UQ_Categories_Name UNIQUE,
    ParentId INT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Categories_CreatedAt DEFAULT SYSUTCDATETIME()
  );

  ALTER TABLE dbo.Categories
    ADD CONSTRAINT FK_Categories_Parent
    FOREIGN KEY (ParentId) REFERENCES dbo.Categories(CategoryId);
END;

IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Products
  (
    ProductId INT IDENTITY(1,1) CONSTRAINT PK_Products PRIMARY KEY,
    CategoryId INT NOT NULL,
    ProductName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Price DECIMAL(18,2) NOT NULL CONSTRAINT CK_Products_Price CHECK (Price >= 0),
    Stock INT NOT NULL CONSTRAINT DF_Products_Stock DEFAULT 0 CONSTRAINT CK_Products_Stock CHECK (Stock >= 0),
    ImageUrl NVARCHAR(500) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(CategoryId)
  );
END;

IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Customers
  (
    CustomerId INT IDENTITY(1,1) CONSTRAINT PK_Customers PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(254) NOT NULL CONSTRAINT UQ_Customers_Email UNIQUE,
    Phone NVARCHAR(30) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Customers_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Orders
  (
    OrderId INT IDENTITY(1,1) CONSTRAINT PK_Orders PRIMARY KEY,
    CustomerId INT NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT N'new',
    TotalAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_Total DEFAULT 0 CONSTRAINT CK_Orders_Total CHECK (TotalAmount >= 0),
    OrderDate DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_Date DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Orders_Status CHECK (Status IN (N'new', N'processing', N'shipped', N'done', N'cancelled')),
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId)
  );
END;

IF OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrderItems
  (
    ItemId INT IDENTITY(1,1) CONSTRAINT PK_OrderItems PRIMARY KEY,
    OrderId INT NOT NULL,
    ProductId INT NOT NULL,
    Qty INT NOT NULL CONSTRAINT CK_OrderItems_Qty CHECK (Qty > 0),
    UnitPrice DECIMAL(18,2) NOT NULL CONSTRAINT CK_OrderItems_Price CHECK (UnitPrice >= 0),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
  );
END;

IF OBJECT_ID(N'dbo.Payments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Payments
  (
    PaymentId INT IDENTITY(1,1) CONSTRAINT PK_Payments PRIMARY KEY,
    OrderId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL CONSTRAINT CK_Payments_Amount CHECK (Amount > 0),
    Method NVARCHAR(30) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT N'pending',
    PaymentDate DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_Date DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT CK_Payments_Status CHECK (Status IN (N'pending', N'paid', N'failed', N'refunded'))
  );
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users
  (
    UserId INT IDENTITY(1,1) CONSTRAINT PK_Users PRIMARY KEY,
    Login NVARCHAR(50) NOT NULL CONSTRAINT UQ_Users_Login UNIQUE,
    PasswordHash NVARCHAR(100) NOT NULL,
    Role NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'customer',
    CustomerId INT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastLoginAt DATETIME2(0) NULL,
    CONSTRAINT CK_Users_Role CHECK (Role IN (N'admin', N'customer')),
    CONSTRAINT FK_Users_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId)
  );
END;

IF OBJECT_ID(N'dbo.Sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Sessions
  (
    SessionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Sessions PRIMARY KEY DEFAULT NEWID(),
    UserId INT NOT NULL,
    TokenHash CHAR(64) NOT NULL CONSTRAINT UQ_Sessions_TokenHash UNIQUE,
    ExpiresAt DATETIME2(0) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Sessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastSeenAt DATETIME2(0) NOT NULL CONSTRAINT DF_Sessions_LastSeenAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Sessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
  );

  CREATE INDEX IX_Sessions_ExpiresAt ON dbo.Sessions(ExpiresAt);
  CREATE INDEX IX_Sessions_UserId ON dbo.Sessions(UserId);
END;

IF OBJECT_ID(N'dbo.Promotions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Promotions
  (
    PromotionId INT IDENTITY(1,1) CONSTRAINT PK_Promotions PRIMARY KEY,
    Title NVARCHAR(160) NOT NULL,
    Description NVARCHAR(1000) NOT NULL,
    DateLabel NVARCHAR(120) NOT NULL,
    ImageUrl NVARCHAR(500) NOT NULL CONSTRAINT DF_Promotions_ImageUrl DEFAULT N'assets/offer-crm.jpg',
    IsActive BIT NOT NULL CONSTRAINT DF_Promotions_IsActive DEFAULT 1,
    CreatedByUserId INT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Promotions_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Promotions_Users FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(UserId)
  );

  CREATE INDEX IX_Promotions_ActiveCreatedAt ON dbo.Promotions(IsActive, CreatedAt DESC);
END;

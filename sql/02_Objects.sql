CREATE OR ALTER VIEW dbo.vw_ProductCatalog
AS
  SELECT p.ProductId, p.ProductName, p.Description, p.Price, p.Stock, p.ImageUrl,
         c.CategoryId, c.CategoryName
  FROM dbo.Products AS p
  INNER JOIN dbo.Categories AS c ON c.CategoryId = p.CategoryId
  WHERE p.IsActive = 1;
GO

CREATE OR ALTER VIEW dbo.vw_OrderSummary
AS
  SELECT o.OrderId, o.OrderDate, o.Status, o.TotalAmount,
         c.CustomerId, c.FullName, c.Email
  FROM dbo.Orders AS o
  INNER JOIN dbo.Customers AS c ON c.CustomerId = o.CustomerId;
GO

CREATE OR ALTER VIEW dbo.vw_OrderDetails
AS
  SELECT oi.ItemId, oi.OrderId, oi.Qty, oi.UnitPrice,
         p.ProductId, p.ProductName,
         CAST(oi.Qty * oi.UnitPrice AS DECIMAL(18,2)) AS LineTotal
  FROM dbo.OrderItems AS oi
  INNER JOIN dbo.Products AS p ON p.ProductId = oi.ProductId;
GO

CREATE OR ALTER VIEW dbo.vw_LowStock
AS
  SELECT ProductId, ProductName, Stock
  FROM dbo.Products
  WHERE IsActive = 1 AND Stock < 5;
GO

CREATE OR ALTER VIEW dbo.vw_RevenueByCategory
AS
  SELECT c.CategoryId, c.CategoryName,
         CAST(SUM(oi.Qty * oi.UnitPrice) AS DECIMAL(18,2)) AS Revenue
  FROM dbo.Categories AS c
  INNER JOIN dbo.Products AS p ON p.CategoryId = c.CategoryId
  INNER JOIN dbo.OrderItems AS oi ON oi.ProductId = p.ProductId
  INNER JOIN dbo.Orders AS o ON o.OrderId = oi.OrderId
  WHERE o.Status <> N'cancelled'
  GROUP BY c.CategoryId, c.CategoryName;
GO

CREATE OR ALTER PROCEDURE dbo.pr_GetProducts
  @CategoryId INT = NULL,
  @MinPrice DECIMAL(18,2) = NULL,
  @MaxPrice DECIMAL(18,2) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT *
  FROM dbo.vw_ProductCatalog
  WHERE (@CategoryId IS NULL OR CategoryId = @CategoryId)
    AND (@MinPrice IS NULL OR Price >= @MinPrice)
    AND (@MaxPrice IS NULL OR Price <= @MaxPrice)
  ORDER BY ProductName;
END;
GO

CREATE OR ALTER PROCEDURE dbo.pr_UpdateOrderStatus
  @OrderId INT,
  @Status NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.Orders SET Status = @Status WHERE OrderId = @OrderId;
  SELECT @@ROWCOUNT AS UpdatedRows;
END;
GO

CREATE OR ALTER PROCEDURE dbo.pr_RegisterUser
  @Login NVARCHAR(50),
  @PasswordHash NVARCHAR(100),
  @Role NVARCHAR(20) = N'customer',
  @CustomerId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.Users (Login, PasswordHash, Role, CustomerId)
  OUTPUT inserted.UserId, inserted.Login, inserted.Role, inserted.CustomerId, inserted.CreatedAt
  VALUES (@Login, @PasswordHash, @Role, @CustomerId);
END;
GO

CREATE OR ALTER PROCEDURE dbo.pr_CreateOrder
  @CustomerId INT,
  @ItemsJson NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRANSACTION;

  DECLARE @OrderId INT;
  INSERT INTO dbo.Orders (CustomerId) VALUES (@CustomerId);
  SET @OrderId = SCOPE_IDENTITY();

  INSERT INTO dbo.OrderItems (OrderId, ProductId, Qty, UnitPrice)
  SELECT @OrderId, j.ProductId, j.Qty, p.Price
  FROM OPENJSON(@ItemsJson)
  WITH (ProductId INT '$.productId', Qty INT '$.qty') AS j
  INNER JOIN dbo.Products AS p ON p.ProductId = j.ProductId
  WHERE j.Qty > 0 AND p.IsActive = 1;

  UPDATE dbo.Orders
  SET TotalAmount = (SELECT COALESCE(SUM(Qty * UnitPrice), 0) FROM dbo.OrderItems WHERE OrderId = @OrderId)
  WHERE OrderId = @OrderId;

  COMMIT TRANSACTION;
  SELECT * FROM dbo.Orders WHERE OrderId = @OrderId;
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_GetOrderTotal(@OrderId INT)
RETURNS DECIMAL(18,2)
AS
BEGIN
  RETURN (SELECT COALESCE(SUM(Qty * UnitPrice), 0) FROM dbo.OrderItems WHERE OrderId = @OrderId);
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_IsInStock(@ProductId INT)
RETURNS BIT
AS
BEGIN
  RETURN (SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.Products WHERE ProductId = @ProductId AND Stock > 0 AND IsActive = 1) THEN 1 ELSE 0 END);
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_GetCustomerOrderCount(@CustomerId INT)
RETURNS INT
AS
BEGIN
  RETURN (SELECT COUNT(*) FROM dbo.Orders WHERE CustomerId = @CustomerId);
END;
GO

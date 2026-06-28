SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.Categories)
BEGIN
  INSERT INTO dbo.Categories (CategoryName)
  VALUES (N'Готовые комплекты'), (N'Оборудование'), (N'Интерактивные устройства');
END;

DECLARE @BundleCategoryId INT = (SELECT CategoryId FROM dbo.Categories WHERE CategoryName = N'Готовые комплекты');

IF NOT EXISTS (SELECT 1 FROM dbo.Products)
BEGIN
  INSERT INTO dbo.Products (CategoryId, ProductName, Description, Price, Stock, ImageUrl)
  VALUES
    (@BundleCategoryId, N'Start', N'Комплект для 12 игроков и площадки до 200 м²', 695500, 5, N'assets/bundle-start.png'),
    (@BundleCategoryId, N'Optima Wireless', N'Комплект для 18 игроков и площадки до 300 м²', 1016500, 4, N'assets/bundle-optima.png'),
    (@BundleCategoryId, N'Smart', N'Комплект для 24 игроков и площадки до 400 м²', 1387850, 3, N'assets/bundle-smart.png'),
    (@BundleCategoryId, N'Pro', N'Комплект для 30 игроков и площадки до 600 м²', 1708850, 2, N'assets/bundle-pro.png'),
    (@BundleCategoryId, N'Elite', N'Комплект для 36 игроков и площадки до 1000 м²', 2068400, 1, N'assets/bundle-elite.png');
END;

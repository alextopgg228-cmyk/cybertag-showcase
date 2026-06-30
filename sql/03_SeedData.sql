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

IF NOT EXISTS (SELECT 1 FROM dbo.Promotions)
BEGIN
  INSERT INTO dbo.Promotions (Title, Description, DateLabel, ImageUrl)
  VALUES
    (N'Уникальное предложение по апгрейду арены', N'Обновление действующей площадки до CYBERTAG 2.0 Black Edition для тех, кому нужен новый уровень игры.', N'Июн 14, 2026 - Июн 14, 2027', N'assets/offer-laserwar.jpg'),
    (N'CRM-система для лазертага в подарок', N'При покупке любой комплектации CYBERTAG доступ к Laserwar CRM предоставляется на три месяца.', N'Июн 14, 2026 - Июн 14, 2027', N'assets/offer-crm.jpg'),
    (N'Франшиза для лазертаг-клуба в подарок', N'Пакет материалов для бизнеса бесплатно при покупке комплекта оборудования для аренного лазертага.', N'Июн 14, 2026 - Июн 14, 2027', N'assets/offer-franchise.jpg');
END;

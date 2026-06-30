-- 1. Каталог комплектов с категорией
EXEC dbo.pr_GetProducts @CategoryId = NULL, @MinPrice = NULL, @MaxPrice = NULL;

-- 2. Карточка товара
SELECT * FROM dbo.vw_ProductCatalog WHERE ProductId = @ProductId;

-- 3. Регистрация: проверка уникальности логина и email
SELECT u.UserId
FROM dbo.Users AS u
LEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId
WHERE u.Login = @Login OR c.Email = @Email;

-- 4. Аутентификация пользователя
SELECT u.UserId, u.Login, u.PasswordHash, u.Role, u.IsActive,
       c.FullName, c.Email
FROM dbo.Users AS u
LEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId
WHERE u.Login = @Identity OR c.Email = @Identity;

-- 5. Создание серверной сессии
INSERT INTO dbo.Sessions (UserId, TokenHash, ExpiresAt)
VALUES (@UserId, @TokenHash, @ExpiresAt);

-- 6. Проверка серверной сессии
SELECT u.UserId, u.Login, u.Role, c.FullName, c.Email
FROM dbo.Sessions AS s
INNER JOIN dbo.Users AS u ON u.UserId = s.UserId
LEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId
WHERE s.TokenHash = @TokenHash AND s.ExpiresAt > SYSUTCDATETIME() AND u.IsActive = 1;

-- 7. Завершение сеанса
DELETE FROM dbo.Sessions WHERE TokenHash = @TokenHash;

-- 8. Обновление даты последнего входа
UPDATE dbo.Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @UserId;

-- 9. Заказы покупателя
SELECT * FROM dbo.vw_OrderSummary WHERE CustomerId = @CustomerId ORDER BY OrderDate DESC;

-- 10. Состав заказа
SELECT * FROM dbo.vw_OrderDetails WHERE OrderId = @OrderId ORDER BY ItemId;

-- 11. Все заказы для администратора
SELECT * FROM dbo.vw_OrderSummary ORDER BY OrderDate DESC, OrderId DESC;

-- 12. Изменение статуса заказа администратором
UPDATE dbo.Orders SET Status = @Status WHERE OrderId = @OrderId;

-- 13. Действующие акции
SELECT PromotionId, Title, Description, DateLabel, ImageUrl, CreatedAt
FROM dbo.Promotions
WHERE IsActive = 1
ORDER BY CreatedAt DESC, PromotionId DESC;

-- 14. Добавление акции администратором
INSERT INTO dbo.Promotions (Title, Description, DateLabel, ImageUrl, CreatedByUserId)
VALUES (@Title, @Description, @DateLabel, @ImageUrl, @UserId);

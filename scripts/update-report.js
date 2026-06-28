import fs from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import PizZip from "pizzip";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];

if (!sourcePath || !outputPath) {
  throw new Error("Usage: node scripts/update-report.js <source.docx> <output.docx>");
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML = "http://www.w3.org/XML/1998/namespace";
const parser = new DOMParser();
const serializer = new XMLSerializer();

const zip = new PizZip(await fs.readFile(sourcePath));
const documentXml = parser.parseFromString(zip.file("word/document.xml").asText(), "application/xml");

const descendants = (node, name) => Array.from(node.getElementsByTagNameNS(W, name));
const directChildren = (node, name) => Array.from(node.childNodes)
  .filter((child) => child.nodeType === 1 && child.namespaceURI === W && child.localName === name);
const paragraphText = (paragraph) => descendants(paragraph, "t").map((node) => node.textContent).join("");

const setParagraphText = (paragraph, text) => {
  const paragraphProperties = directChildren(paragraph, "pPr")[0]?.cloneNode(true);
  const firstRunProperties = descendants(paragraph, "rPr")[0]?.cloneNode(true);
  while (paragraph.firstChild) paragraph.removeChild(paragraph.firstChild);
  if (paragraphProperties) paragraph.appendChild(paragraphProperties);

  const lines = String(text).split("\n");
  lines.forEach((line, index) => {
    const run = documentXml.createElementNS(W, "w:r");
    if (firstRunProperties) run.appendChild(firstRunProperties.cloneNode(true));
    const textNode = documentXml.createElementNS(W, "w:t");
    textNode.setAttributeNS(XML, "xml:space", "preserve");
    textNode.appendChild(documentXml.createTextNode(line));
    run.appendChild(textNode);
    paragraph.appendChild(run);
    if (index < lines.length - 1) {
      const breakRun = documentXml.createElementNS(W, "w:r");
      const lineBreak = documentXml.createElementNS(W, "w:br");
      breakRun.appendChild(lineBreak);
      paragraph.appendChild(breakRun);
    }
  });
};

const replaceParagraphs = (replacements) => {
  const paragraphs = descendants(documentXml, "p");
  const missing = [];
  for (const [source, replacement] of Object.entries(replacements)) {
    const paragraph = paragraphs.find((candidate) => paragraphText(candidate).trim() === source.trim());
    if (!paragraph) {
      missing.push(source.slice(0, 80));
      continue;
    }
    setParagraphText(paragraph, replacement);
  }
  return missing;
};

const setCellText = (cell, text) => {
  const paragraphs = directChildren(cell, "p");
  const paragraph = paragraphs[0];
  if (!paragraph) return;
  setParagraphText(paragraph, text);
  paragraphs.slice(1).forEach((extra) => cell.removeChild(extra));
};

const setTable = (index, headers, rows) => {
  const table = descendants(documentXml, "tbl")[index];
  if (!table) throw new Error(`Table ${index + 1} not found`);
  let tableRows = directChildren(table, "tr");
  const template = (tableRows[1] || tableRows[0]).cloneNode(true);
  const targetCount = rows.length + 1;

  while (tableRows.length < targetCount) {
    table.appendChild(template.cloneNode(true));
    tableRows = directChildren(table, "tr");
  }
  while (tableRows.length > targetCount) {
    table.removeChild(tableRows[tableRows.length - 1]);
    tableRows = directChildren(table, "tr");
  }

  [headers, ...rows].forEach((values, rowIndex) => {
    const cells = directChildren(tableRows[rowIndex], "tc");
    values.forEach((value, cellIndex) => setCellText(cells[cellIndex], String(value)));
  });
};

const replacements = {
  "В рамках практики разработана информационная система интернет-магазина оборудования для лазертага CYBERTAG. Система обеспечивает хранение сведений о товарах, категориях, клиентах, заказах и транзакциях, а также предоставляет адаптивный веб-интерфейс. Для администратора реализована панель управления каталогом с аутентификацией на основе JWT-токенов.":
    "В рамках практики разработана информационная система CYBERTAG с адаптивным многостраничным веб-интерфейсом, серверным приложением Node.js/Express и базой данных Microsoft SQL Server 2022 Express. Реализованы регистрация, вход по логину или email, безопасное хранение bcrypt-хэшей паролей и серверные пользовательские сессии.",
  "реализованы таблицы, ограничения целостности, представления, хранимые процедуры и пользовательские функции в MS SQL Server 2022;":
    "реализованы 8 таблиц, ограничения целостности, 5 представлений, 4 хранимые процедуры и 3 пользовательские функции в Microsoft SQL Server 2022 Express;",
  "реализована аутентификация пользователей с использованием JWT-токенов и разграничением ролей;":
    "реализованы регистрация и вход с bcrypt-хэшированием паролей, HttpOnly cookie и хранением серверных сессий в SQL Server;",
  "решены вопросы администрирования, резервного копирования и защиты персональных данных;":
    "реализованы параметризованные запросы, проверка уникальности логина и email, ограничение попыток входа и защита персональных данных;",
  "Практическая значимость работы состоит в том, что разработанная система демонстрирует полный цикл: от анализа требований до публикации демонстрационной витрины на GitHub Pages по адресу https://alextopgg228-cmyk.github.io/cybertag-showcase/.":
    "Практическая значимость работы состоит в демонстрации полного цикла: от анализа требований и проектирования SQL-базы до работающей серверной регистрации. Статическая витрина размещена на GitHub Pages, а полная версия запускается на Node.js-сервере с подключением к SQL Server.",
  "CYBERTAG — интернет-магазин профессионального снаряжения для лазертага, ориентированный на частных покупателей, лазертаг-арены и корпоративных клиентов России и стран СНГ. Магазин предлагает полный ассортимент оборудования: маски, жилеты с датчиками, бластеры, зарядные устройства, запасные аккумуляторы и аксессуары. Каталог насчитывает более 50 позиций, сгруппированных по функциональным категориям.":
    "CYBERTAG — многостраничный сайт профессионального оборудования для аренного лазертага, ориентированный на владельцев арен и корпоративных клиентов. В интерфейсе представлены оборудование, пять готовых комплектов, программное обеспечение, акции, корзина и контакты отдела продаж.",
  "В системе выделяются три роли. Гость (незарегистрированный посетитель) просматривает витрину и формирует корзину. Покупатель (customer) оформляет заказы и отслеживает их статус в личном кабинете. Администратор (admin) управляет каталогом товаров, обрабатывает заказы, создаёт пользовательские учётные записи и просматривает статистику базы данных.":
    "В системе выделяются гость, зарегистрированный пользователь (customer) и администратор (admin). Гость просматривает страницы и формирует корзину. Зарегистрированный пользователь может перейти к оформлению после серверной авторизации. Роль администратора используется демонстрационной учётной записью manager и зарезервирована для дальнейшего расширения функций.",
  "Центральными таблицами являются Products и Orders, к которым обращаются наиболее часто. Таблица OrderItems содержит внешние ключи на Orders и Products, обеспечивая хранение состава каждой покупки без дублирования данных о товаре в каждой строке заказа. Для демонстрации работы системы подготовлен учебный набор данных: 6 категорий, 20 товаров, 10 клиентов, 15 заказов, 30 позиций заказа, 15 платёжных транзакций и 3 учётные записи пользователей.":
    "Предметная модель содержит таблицы каталога и заказов, а действующий контур авторизации использует Customers, Users и Sessions. При инициализации создаются 3 категории, 5 комплектов и демонстрационная учётная запись manager. Новые пользователи и их сессии появляются в базе только после регистрации и входа.",
  "Основной поток данных начинается с открытия пользователем страницы витрины. Браузер отображает интерфейс и отправляет HTTP-запросы к серверному API на Node.js/Express. Сервер получает параметры запроса, выполняет соответствующий SQL-запрос к базе данных MS SQL Server 2022 и возвращает результат в формате JSON. Клиентский JavaScript формирует из этих данных карточки товаров и таблицы заказов без перезагрузки страницы.":
    "Основной серверный поток начинается при открытии страницы входа или регистрации. Клиентский JavaScript отправляет JSON-запрос к API Node.js/Express. Сервер валидирует данные, выполняет параметризованный запрос к Microsoft SQL Server и возвращает результат в формате JSON. Статические карточки оборудования и комплектов сохраняют прежнюю вёрстку.",
  "При фильтрации каталога пользователь выбирает категорию и задаёт ценовой диапазон. Эти параметры передаются в маршрут /api/products. Сервер выполняет SQL-запрос с условием WHERE по CategoryId и полю Price. В результате пользователь видит только товары, соответствующие заданным критериям.":
    "Корзина хранится локально в браузере, поскольку не содержит персональных данных. Перед оформлением клиент запрашивает /api/auth/me. При отсутствии действующей серверной сессии пользователь переводится на страницу входа или регистрации.",
  "Поток аутентификации начинается с ввода логина и пароля в форму входа. Клиент отправляет данные на сервер в теле POST-запроса. Сервер извлекает запись пользователя из таблицы Users, проверяет пароль с использованием bcrypt и при успешной проверке возвращает подписанный JWT-токен. Клиент сохраняет токен в localStorage и включает его в заголовок Authorization последующих запросов.":
    "Поток аутентификации начинается с ввода логина или email и пароля. Сервер извлекает пользователя из Users и Customers, проверяет bcrypt-хэш и создаёт случайный 256-битный токен. В Sessions сохраняется только SHA-256-хэш токена, а браузеру передаётся HttpOnly cookie с атрибутом SameSite=Lax. Пароль и токен не сохраняются в localStorage.",
  "Административный поток изменяет состояние данных. После успешного входа администратор получает доступ к панели управления каталогом. При добавлении нового товара браузер отправляет POST-запрос с данными формы. Сервер проверяет JWT-токен и роль, затем выполняет INSERT в таблицу Products. При изменении или удалении — UPDATE или DELETE соответственно. Основные потоки данных системы представлены в таблице ниже:":
    "Поток регистрации выполняется в транзакции уровня SERIALIZABLE. Сервер проверяет уникальность логина и email, создаёт запись Customers, вызывает процедуру pr_RegisterUser и создаёт строку Sessions. При любой ошибке транзакция откатывается. Основные потоки данных представлены в таблице ниже:",
  "спроектировать реляционную базу данных CybertagShop с 7 таблицами;":
    "спроектировать реляционную базу данных CybertagShop с 8 таблицами, включая Users и Sessions;",
  "создать адаптивный веб-сайт с витриной, корзиной и личным кабинетом;":
    "сохранить адаптивный многостраничный сайт, отдельную корзину и личный кабинет без изменения оформления;",
  "реализовать аутентификацию пользователей с JWT и разграничением ролей;":
    "реализовать регистрацию и вход через SQL Server, bcrypt и серверные cookie-сессии;",
  "реализовать панель администратора с управлением каталогом и заказами;":
    "реализовать API проверки текущей сессии, выхода и автоматического продолжения оформления заказа;",
  "опубликовать демонстрационную версию на GitHub Pages;":
    "опубликовать исходный код и статическую витрину, предусмотрев отдельный запуск полной серверной версии;",
  "В качестве СУБД выбрана Microsoft SQL Server 2022 Developer Edition. Эта СУБД поддерживает связи по внешним ключам, представления, хранимые процедуры, пользовательские функции и параметризованные запросы. Разработка SQL-скриптов выполнялась в среде Microsoft SQL Server Management Studio 19 (SSMS). Выбор обоснован широкой распространённостью СУБД в коммерческих организациях и поддержкой Unicode (NVARCHAR) для хранения кириллических данных.":
    "В качестве СУБД используется Microsoft SQL Server 2022 Express (экземпляр SQLEXPRESS). СУБД поддерживает внешние ключи, представления, процедуры, функции и параметризованные запросы. Подключение Node.js выполняется через mssql/msnodesqlv8 и ODBC Driver 17 с Windows Authentication. Unicode-данные хранятся в NVARCHAR.",
  "Серверная часть приложения реализована на Node.js с фреймворком Express. Для работы с SQL Server использован пакет mssql. Аутентификация построена на библиотеке jsonwebtoken с хранением секретного ключа в переменных окружения. Клиентская часть построена на HTML5, CSS3 и Vanilla JavaScript без тяжёлых фреймворков, что упрощает сопровождение и публикацию статической витрины. Используемые средства разработки представлены в таблице ниже:":
    "Серверная часть реализована на Node.js и Express. Для SQL Server используются mssql и msnodesqlv8, пароли хэшируются bcryptjs. Сессия хранится в таблице Sessions, а браузер получает HttpOnly cookie. Клиентская часть остаётся на HTML5, CSS3 и Vanilla JavaScript, поэтому визуальное оформление сайта не изменилось.",
  "Информационная система выполняет функции просмотра каталога товаров, фильтрации по категории и ценовому диапазону, полнотекстового поиска по наименованию, управления корзиной, оформления заказа, аутентификации пользователей, администрирования каталога, обработки заказов и отображения статистики базы данных.":
    "Информационная система выполняет функции просмотра оборудования и комплектов, управления корзиной, регистрации, входа по логину или email, проверки и завершения серверной сессии, перехода к оформлению и отображения личного кабинета.",
  "Логическая модель базы данных строится вокруг товаров, клиентов, заказов, платёжных транзакций и пользователей системы. Справочные данные о группах товаров вынесены в отдельную таблицу Categories с поддержкой иерархии через поле ParentId. Это позволяет не повторять название категории в каждой строке таблицы Products.":
    "Логическая модель базы CybertagShop содержит предметные таблицы каталога и заказов, а также рабочий контур аутентификации. Customers хранит имя и email, Users — логин, bcrypt-хэш и роль, Sessions — SHA-256-хэш токена и срок действия. Categories поддерживает иерархию через ParentId.",
  "Таблица OrderItems является связующей: она объединяет заказ и товар, фиксируя количество и цену на момент покупки. Поле UnitPrice в OrderItems хранит историческую цену, независимую от текущей цены товара. Таблица Users хранит учётные записи, связанные с записями покупателей через необязательный внешний ключ CustomerId.":
    "OrderItems связывает заказ и товар, фиксируя количество и историческую цену. Users связан с Customers необязательным внешним ключом CustomerId. Sessions связан с Users отношением 1:N и удаляется каскадно вместе с пользователем.",
  "Для хранения денежных значений используется тип MONEY. Для дат и времени — DATETIME. Для строк с поддержкой кириллицы — NVARCHAR. Поле Status таблицы Orders содержит ограничение CHECK, допускающее значения «new», «processing», «shipped», «done». Поле Role таблицы Users допускает три значения CHECK: «admin», «customer», «guest». Перечень столбцов ключевых таблиц представлен в таблице ниже:":
    "Для денежных значений используется DECIMAL(18,2), для дат и времени — DATETIME2(0), для строк с поддержкой кириллицы — NVARCHAR. Поле Status таблицы Orders ограничено значениями «new», «processing», «shipped», «done», «cancelled». Поле Role таблицы Users допускает значения «admin» и «customer»; гость не имеет записи в Users. Перечень столбцов ключевых таблиц представлен в таблице ниже:",
  "Представления используются для упрощения выборки данных в маршрутах API без написания сложных JOIN-запросов в каждом обработчике. Каждое представление инкапсулирует одну тематическую выборку с объединением нескольких таблиц. Перечень созданных представлений представлен в таблице ниже:":
    "Представления инкапсулируют выборки каталога и заказов. Авторизация использует отдельные параметризованные запросы к Users, Customers и Sessions. Перечень созданных представлений представлен в таблице ниже:",
  "Параметризованные запросы разработаны в файле 04_Queries.sql. Все запросы принимают входные параметры через конструкцию @ParameterName, что исключает SQL-инъекции при вызове из серверного API. Запросы охватывают все сценарии работы системы: просмотр витрины, управление заказами, аутентификацию и администрирование. Перечень запросов с описанием и ключевыми параметрами представлен в таблице ниже:":
    "Параметризованные запросы находятся в sql/04_Queries.sql. Они охватывают регистрацию, вход, создание, проверку и удаление сессии, дату последнего входа, а также выборки каталога и заказов. Значения передаются через параметры mssql, а не формируются конкатенацией строк.",
  "В ходе практики разработана информационная система интернет-магазина лазертаг-оборудования CYBERTAG. Все задачи, поставленные в введении, выполнены в полном объёме.":
    "В ходе практики доработана информационная система CYBERTAG: существующее оформление сохранено, а статическая демонстрационная авторизация заменена реальной регистрацией и входом через Microsoft SQL Server.",
  "Реализована реляционная база данных CybertagShop в среде MS SQL Server 2022, содержащая 7 взаимосвязанных таблиц. Целостность данных обеспечивается первичными ключами, 7 внешними ключами, CHECK- и UNIQUE-ограничениями. Разработан полный комплект SQL-скриптов: создание таблиц, внешние ключи, заполнение тестовыми данными, 10 параметризованных запросов, 5 представлений, 4 хранимые процедуры и 3 пользовательские функции.":
    "Реализована база CybertagShop в Microsoft SQL Server 2022 Express, содержащая 8 взаимосвязанных таблиц. Целостность обеспечивается первичными и внешними ключами, CHECK-, UNIQUE- и DEFAULT-ограничениями. Подготовлены скрипты схемы, тестовых данных, 10 параметризованных запросов, 5 представлений, 4 процедуры и 3 функции.",
  "Реализован серверный REST API на Node.js/Express с подключением к SQL Server через пакет mssql. Аутентификация построена на JWT-токенах с разграничением ролей администратора и покупателя. Разработана адаптивная клиентская часть на HTML5, CSS3 и Vanilla JavaScript, включающая витрину товаров, систему фильтрации, корзину, форму оформления заказа и административную панель.":
    "Реализован REST API Node.js/Express с подключением через mssql/msnodesqlv8. Регистрация сохраняет Customers и Users в транзакции, пароли хэшируются bcrypt, а серверные сессии хранятся в Sessions. Клиентская часть сохранила существующие HTML, CSS и Vanilla JavaScript, корзину и форму контактов.",
  "Демонстрационная статическая витрина опубликована на GitHub Pages по адресу https://alextopgg228-cmyk.github.io/cybertag-showcase/. Подготовлена сопроводительная документация: словарь данных, описание экранных форм, схемы архитектуры и инструкция по развёртыванию.":
    "Статическая витрина доступна на GitHub Pages. Полная версия с регистрацией запускается командой npm start на сервере Node.js, имеющем доступ к SQL Server. Подготовлены SQL-скрипты, описание форм, архитектуры и инструкция по развёртыванию.",
  "4.JSON Web Tokens – JWT.io. – URL: https://jwt.io/ (дата обращения: 12.06.2026).":
    "4. node-mssql — Microsoft SQL Server client for Node.js. — URL: https://github.com/tediousjs/node-mssql (дата обращения: 28.06.2026).",
  "-- ВСТАВЬ СЮДА команду BACKUP DATABASE CybertagShop":
    "BACKUP DATABASE CybertagShop\nTO DISK = N'C:\\Backups\\CybertagShop.bak'\nWITH INIT, CHECKSUM, NAME = N'CybertagShop full backup';",
  "-- ВСТАВЬ СЮДА содержимое файла 01_CreateTables.sql":
    "CREATE TABLE dbo.Users (\n  UserId INT IDENTITY(1,1) PRIMARY KEY,\n  Login NVARCHAR(50) NOT NULL UNIQUE,\n  PasswordHash NVARCHAR(100) NOT NULL,\n  Role NVARCHAR(20) NOT NULL DEFAULT N'customer',\n  CustomerId INT NULL,\n  IsActive BIT NOT NULL DEFAULT 1,\n  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),\n  LastLoginAt DATETIME2(0) NULL\n);\nCREATE TABLE dbo.Sessions (\n  SessionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),\n  UserId INT NOT NULL, TokenHash CHAR(64) NOT NULL UNIQUE,\n  ExpiresAt DATETIME2(0) NOT NULL,\n  FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE\n);",
  "-- (CREATE DATABASE CybertagShop + все CREATE TABLE с ограничениями PK/CHECK/DEFAULT)":
    "Полный идемпотентный скрипт восьми таблиц с ограничениями находится в sql/01_Schema.sql.",
  "-- ВСТАВЬ СЮДА содержимое файла 02_ForeignKeys.sql":
    "ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId);\nALTER TABLE dbo.Sessions ADD CONSTRAINT FK_Sessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE;",
  "-- (все ALTER TABLE ... ADD CONSTRAINT FK_... FOREIGN KEY ...)":
    "Связи создаются непосредственно в sql/01_Schema.sql после родительских таблиц.",
  "-- ВСТАВЬ СЮДА содержимое файла 03_InsertData.sql":
    "INSERT INTO dbo.Products (CategoryId, ProductName, Price, Stock, ImageUrl)\nVALUES (@BundleCategoryId, N'Start', 695500, 5, N'assets/bundle-start.png');",
  "-- (INSERT INTO Categories ... INSERT INTO Products ... INSERT INTO Customers ... и т.д.)":
    "Полный учебный набор из трёх категорий и пяти комплектов находится в sql/03_SeedData.sql.",
  "-- ВСТАВЬ СЮДА содержимое файла 04_Queries.sql":
    "SELECT u.UserId, u.Login, u.PasswordHash, u.Role, c.FullName, c.Email\nFROM dbo.Users AS u\nLEFT JOIN dbo.Customers AS c ON c.CustomerId = u.CustomerId\nWHERE u.Login = @Identity OR c.Email = @Identity;",
  "-- (все 10 параметризованных запросов: Запрос 1 ... Запрос 10)":
    "Все десять запросов регистрации, входа, сессий, каталога и заказов приведены в sql/04_Queries.sql.",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER VIEW vw_ProductCatalog":
    "CREATE OR ALTER VIEW dbo.vw_ProductCatalog AS SELECT p.ProductId, p.ProductName, p.Price, p.Stock, c.CategoryName FROM dbo.Products p INNER JOIN dbo.Categories c ON c.CategoryId=p.CategoryId WHERE p.IsActive=1;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER VIEW vw_OrderSummary":
    "CREATE OR ALTER VIEW dbo.vw_OrderSummary AS SELECT o.OrderId, o.Status, o.TotalAmount, c.FullName, c.Email FROM dbo.Orders o INNER JOIN dbo.Customers c ON c.CustomerId=o.CustomerId;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER VIEW vw_OrderDetails":
    "CREATE OR ALTER VIEW dbo.vw_OrderDetails AS SELECT oi.OrderId, p.ProductName, oi.Qty, oi.UnitPrice FROM dbo.OrderItems oi INNER JOIN dbo.Products p ON p.ProductId=oi.ProductId;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER VIEW vw_LowStock":
    "CREATE OR ALTER VIEW dbo.vw_LowStock AS SELECT ProductId, ProductName, Stock FROM dbo.Products WHERE IsActive=1 AND Stock<5;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER VIEW vw_RevenueByCategory":
    "CREATE OR ALTER VIEW dbo.vw_RevenueByCategory AS SELECT c.CategoryName, SUM(oi.Qty*oi.UnitPrice) Revenue FROM dbo.Categories c JOIN dbo.Products p ON p.CategoryId=c.CategoryId JOIN dbo.OrderItems oi ON oi.ProductId=p.ProductId GROUP BY c.CategoryName;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER PROCEDURE pr_GetProducts":
    "CREATE OR ALTER PROCEDURE dbo.pr_GetProducts @CategoryId INT=NULL, @MinPrice DECIMAL(18,2)=NULL, @MaxPrice DECIMAL(18,2)=NULL AS SELECT * FROM dbo.vw_ProductCatalog WHERE (@CategoryId IS NULL OR CategoryId=@CategoryId) AND (@MinPrice IS NULL OR Price>=@MinPrice) AND (@MaxPrice IS NULL OR Price<=@MaxPrice);",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER PROCEDURE pr_CreateOrder":
    "CREATE OR ALTER PROCEDURE dbo.pr_CreateOrder @CustomerId INT, @ItemsJson NVARCHAR(MAX) AS BEGIN TRANSACTION; -- разбор OPENJSON, вставка Orders и OrderItems; COMMIT;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER PROCEDURE pr_UpdateOrderStatus":
    "CREATE OR ALTER PROCEDURE dbo.pr_UpdateOrderStatus @OrderId INT, @Status NVARCHAR(20) AS UPDATE dbo.Orders SET Status=@Status WHERE OrderId=@OrderId;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER PROCEDURE pr_RegisterUser":
    "CREATE OR ALTER PROCEDURE dbo.pr_RegisterUser @Login NVARCHAR(50), @PasswordHash NVARCHAR(100), @Role NVARCHAR(20), @CustomerId INT AS INSERT INTO dbo.Users(Login,PasswordHash,Role,CustomerId) VALUES(@Login,@PasswordHash,@Role,@CustomerId);",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER FUNCTION fn_GetOrderTotal":
    "CREATE OR ALTER FUNCTION dbo.fn_GetOrderTotal(@OrderId INT) RETURNS DECIMAL(18,2) AS BEGIN RETURN (SELECT COALESCE(SUM(Qty*UnitPrice),0) FROM dbo.OrderItems WHERE OrderId=@OrderId); END;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER FUNCTION fn_GetProductRating":
    "CREATE OR ALTER FUNCTION dbo.fn_GetCustomerOrderCount(@CustomerId INT) RETURNS INT AS BEGIN RETURN (SELECT COUNT(*) FROM dbo.Orders WHERE CustomerId=@CustomerId); END;",
  "-- ВСТАВЬ СЮДА CREATE OR ALTER FUNCTION fn_IsInStock":
    "CREATE OR ALTER FUNCTION dbo.fn_IsInStock(@ProductId INT) RETURNS BIT AS BEGIN RETURN (SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.Products WHERE ProductId=@ProductId AND Stock>0) THEN 1 ELSE 0 END); END;",
  "Модальное окно входа содержит поля «Email» и «Пароль», кнопки «Войти» и «Закрыть». После ввода данных браузер отправляет POST-запрос к /api/auth/login. Сервер проверяет пароль через bcrypt и при успехе возвращает JWT-токен. Токен сохраняется в localStorage. Для admin появляется пункт «Панель» в навигационном меню.":
    "Отдельная страница входа содержит поля «Логин или email» и «Пароль». POST /api/auth/login проверяет bcrypt-хэш, создаёт запись Sessions и устанавливает HttpOnly cookie. Секретные данные не сохраняются в localStorage.",
  "В.3 Панель администратора": "В.3 Регистрация и личный кабинет",
  "Панель включает четыре блока: «Добавить товар» — форма с полями «Название», «Категория», «Цена», «Остаток», «Описание», «Изображение»; «Управление каталогом» — таблица всех товаров с кнопками «Изменить» и «Удалить»; «Заказы» — таблица заказов с возможностью изменить статус; «Статистика» — сводная таблица счётчиков по всем таблицам БД.":
    "Страница регистрации содержит имя, логин, email, пароль и подтверждение. После успешной транзакции пользователь автоматически получает серверную сессию. В личном кабинете отображаются имя пользователя, корзина, локальные заявки и кнопка выхода.",
  "Первое звено — браузер пользователя: HTML/CSS/JavaScript интерфейс, HTTP-запросы с JWT в заголовках. Второе звено — серверное приложение Node.js/Express: маршрутизация, проверка токена, формирование SQL-запросов. Третье звено — СУБД MS SQL Server 2022: хранение, выборка, изменение и резервное копирование данных.":
    "Первое звено — браузер с HTML/CSS/JavaScript и HttpOnly cookie. Второе — Node.js/Express: валидация, bcrypt, управление сессиями и параметризованные запросы. Третье — Microsoft SQL Server 2022 Express: Customers, Users, Sessions и предметные таблицы.",
  "Установить Microsoft SQL Server 2022 (Developer или Standard Edition).": "Установить Microsoft SQL Server 2022 Express и ODBC Driver 17 for SQL Server.",
  "Открыть SQL Server Management Studio 19, создать подключение к серверу.": "Запустить экземпляр SQLEXPRESS и проверить Windows Authentication командой sqlcmd -S .\\SQLEXPRESS -E.",
  "Открыть и выполнить файл 01_CreateTables.sql. В журнале должно появиться: «Таблицы успешно созданы.»": "Выполнить npm install, затем npm run db:init; скрипт создаст CybertagShop и выполнит sql/01_Schema.sql.",
  "Открыть и выполнить файл 02_ForeignKeys.sql. В журнале: «Внешние ключи успешно созданы.»": "Инициализация автоматически выполнит sql/02_Objects.sql и создаст представления, процедуры и функции.",
  "Открыть и выполнить файл 03_InsertData.sql для загрузки тестовых данных.": "Файл sql/03_SeedData.sql автоматически добавит три категории и пять комплектов.",
  "Проверить: SELECT COUNT(*) FROM dbo.Products. Ожидаемый результат: 20.": "Проверить GET /api/health: ожидается database = Microsoft SQL Server и Products = 5.",
  "Настроить учётную запись приложения с минимально необходимыми правами (db_datareader + EXECUTE).": "Для локальной разработки используется Windows Authentication; для сервера следует создать отдельного SQL-пользователя с минимальными правами.",
  "Настроить задание SQL Server Agent для еженедельного резервного копирования.": "Настроить резервное копирование CybertagShop и очистку просроченных строк Sessions.",
  "Установить Node.js версии 18 LTS и выполнить npm install в папке проекта.": "Установить Node.js 20 или новее и выполнить npm install.",
  "Создать файл .env с переменными DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET.": "Создать .env на основе .env.example и задать DB_CONNECTION_STRING, DB_MASTER_CONNECTION_STRING, SESSION_DAYS и COOKIE_SECURE.",
  "Запустить сервер командой node server.js или npm start.": "Выполнить npm run db:init, затем npm start.",
  "Проверить доступность API по адресу http://localhost:3000/api/products.": "Проверить http://127.0.0.1:3000/api/health, затем страницы /register/ и /login/.",
  "Д.3 Публикация на GitHub Pages": "Д.3 Публикация и ограничение GitHub Pages",
  "Создать репозиторий на GitHub, загрузить файлы HTML, CSS, JavaScript и data.json.": "Загрузить исходный код, SQL-скрипты и отчёт в GitHub-репозиторий.",
  "Перейти в настройки репозитория (Settings → Pages).": "GitHub Pages использовать только для статической демонстрационной витрины.",
  "В разделе «Source» выбрать ветку main и папку /root, нажать «Save».": "Полную версию разместить на Windows-сервере с Node.js, ODBC Driver 17 и доступом к SQL Server.",
  "Проверить доступность витрины по адресу https://alextopgg228-cmyk.github.io/cybertag-showcase/.": "Проверить регистрацию, запись Users/Customers, создание Sessions, выход и повторный вход."
};

const missingParagraphs = replaceParagraphs(replacements);

setTable(0,
  ["Объект", "Назначение", "Пример данных"],
  [
    ["Категории (Categories)", "Группы оборудования", "Готовые комплекты, оборудование"],
    ["Товары (Products)", "Учебный каталог", "Start, Optima Wireless, Elite"],
    ["Клиенты (Customers)", "Имя и email зарегистрированных пользователей", "Иванов И.И., ivan@example.ru"],
    ["Заказы (Orders)", "Заготовка для оформления", "Дата, сумма, статус"],
    ["Позиции заказа (OrderItems)", "Состав заказа", "Товар, количество, цена"],
    ["Платежи (Payments)", "Транзакции заказа", "Метод, сумма, статус"],
    ["Пользователи (Users)", "Логин, bcrypt-хэш, роль", "manager, customer"],
    ["Сессии (Sessions)", "Серверные сеансы", "SHA-256 токена, срок действия"]
  ]);

setTable(1,
  ["Инициатор", "Запрос", "Обработчик", "Результат"],
  [
    ["Браузер", "POST /api/auth/register", "Валидация + bcrypt + SQL-транзакция", "Customers, Users, Sessions"],
    ["Браузер", "POST /api/auth/login", "bcrypt.compare + SQL", "HttpOnly cookie"],
    ["Браузер", "GET /api/auth/me", "Проверка Sessions", "JSON текущего пользователя"],
    ["Браузер", "POST /api/auth/logout", "DELETE Sessions", "204 + удаление cookie"],
    ["Браузер", "GET /api/health", "SQL-счётчики", "Состояние БД"],
    ["Браузер", "Статические страницы", "Express static", "HTML/CSS/JS и изображения"],
    ["Пользователь", "Корзина", "localStorage без персональных данных", "Состав и сумма"],
    ["Администратор", "npm run db:init", "SQL-скрипты", "Схема и тестовые данные"]
  ]);

setTable(2,
  ["Средство", "Назначение", "Использование в проекте"],
  [
    ["MS SQL Server 2022 Express", "Реляционная СУБД", "8 таблиц, ограничения, объекты БД"],
    ["ODBC Driver 17", "Драйвер подключения", "Windows Authentication"],
    ["mssql + msnodesqlv8", "Доступ Node.js к SQL Server", "Пулы и параметризованные запросы"],
    ["Node.js / Express", "Серверное приложение", "REST API и статические страницы"],
    ["bcryptjs", "Защита паролей", "Хэш с 12 раундами"],
    ["HttpOnly cookie", "Идентификатор сессии", "SameSite=Lax, срок 7 дней"],
    ["HTML5, CSS3, Vanilla JS", "Клиентский интерфейс", "Существующее оформление без изменений"],
    ["Node test", "Интеграционное тестирование", "Регистрация, вход, сессия, выход"]
  ]);

setTable(3,
  ["Функция", "Раздел сайта", "Результат"],
  [
    ["Просмотр оборудования", "Оборудование", "Карточки устройств"],
    ["Просмотр комплектов", "Комплекты", "Пять конфигураций и цены"],
    ["Управление корзиной", "Корзина", "Добавление, удаление, сумма"],
    ["Регистрация", "Регистрация", "Customers + Users + Sessions в SQL"],
    ["Вход", "Вход", "Проверка bcrypt-хэша и cookie"],
    ["Проверка сессии", "Все разделы", "Имя пользователя и кабинет"],
    ["Выход", "Контакты", "Удаление SQL-сессии"],
    ["Оформление", "Корзина / Контакты", "Переход после авторизации"],
    ["Просмотр софта", "Софт", "Описание и системные требования"]
  ]);

setTable(4,
  ["Таблица", "Назначение", "Ключевые поля"],
  [
    ["Categories", "Категории", "CategoryId, CategoryName, ParentId"],
    ["Products", "Учебный каталог", "ProductId, CategoryId, ProductName, Price"],
    ["Customers", "Профили пользователей", "CustomerId, FullName, Email"],
    ["Orders", "Заказы", "OrderId, CustomerId, Status, TotalAmount"],
    ["OrderItems", "Позиции заказов", "ItemId, OrderId, ProductId, Qty"],
    ["Payments", "Платежи", "PaymentId, OrderId, Amount, Status"],
    ["Users", "Учётные записи", "UserId, Login, PasswordHash, Role"],
    ["Sessions", "Сеансы", "SessionId, UserId, TokenHash, ExpiresAt"]
  ]);

setTable(5,
  ["Исходная проблема", "Решение в проекте", "Результат"],
  [
    ["Повтор данных категории", "Categories + внешний ключ", "Нет дублирования"],
    ["Повтор профиля в учётной записи", "Customers отдельно от Users", "Разделение профиля и доступа"],
    ["Пароль в открытом виде", "bcrypt-хэш в Users", "Пароль невозможно восстановить"],
    ["Токен сессии в открытом виде", "SHA-256 в Sessions", "Утечка БД не раскрывает cookie"],
    ["Неограниченный срок входа", "ExpiresAt", "Сессия действует ограниченное время"],
    ["Дублирование логина и email", "UNIQUE + транзакция", "Гарантия уникальности"]
  ]);

setTable(6,
  ["Поле", "Тип данных", "Обязательное", "Назначение"],
  [
    ["UserId", "INT IDENTITY", "Да (PK)", "Код пользователя"],
    ["Login", "NVARCHAR(50)", "Да (UQ)", "Уникальный логин"],
    ["PasswordHash", "NVARCHAR(100)", "Да", "bcrypt-хэш"],
    ["Role", "NVARCHAR(20)", "Да", "admin / customer"],
    ["CustomerId", "INT", "Нет (FK)", "Связь с профилем"],
    ["IsActive", "BIT", "Да", "Разрешение входа"],
    ["SessionId", "UNIQUEIDENTIFIER", "Да (PK)", "Код сессии"],
    ["TokenHash", "CHAR(64)", "Да (UQ)", "SHA-256 токена"],
    ["ExpiresAt", "DATETIME2", "Да", "Срок действия"],
    ["CreatedAt", "DATETIME2", "Да", "Дата создания"],
    ["LastSeenAt", "DATETIME2", "Да", "Последняя проверка"]
  ]);

setTable(7,
  ["Имя ограничения", "Дочерняя таблица (FK)", "Родительская таблица (PK)"],
  [
    ["FK_Products_Categories", "Products(CategoryId)", "Categories(CategoryId)"],
    ["FK_Categories_Parent", "Categories(ParentId)", "Categories(CategoryId)"],
    ["FK_Orders_Customers", "Orders(CustomerId)", "Customers(CustomerId)"],
    ["FK_OrderItems_Orders", "OrderItems(OrderId)", "Orders(OrderId)"],
    ["FK_OrderItems_Products", "OrderItems(ProductId)", "Products(ProductId)"],
    ["FK_Payments_Orders", "Payments(OrderId)", "Orders(OrderId)"],
    ["FK_Users_Customers", "Users(CustomerId)", "Customers(CustomerId)"],
    ["FK_Sessions_Users", "Sessions(UserId)", "Users(UserId), CASCADE"]
  ]);

setTable(8,
  ["Представление", "Назначение"],
  [
    ["vw_ProductCatalog", "Активные товары с категорией"],
    ["vw_OrderSummary", "Заказы с профилем клиента"],
    ["vw_OrderDetails", "Состав заказа и сумма строки"],
    ["vw_LowStock", "Активные товары с остатком менее 5"],
    ["vw_RevenueByCategory", "Выручка по категориям"]
  ]);

setTable(9,
  ["Процедура", "Параметры", "Назначение"],
  [
    ["pr_GetProducts", "@CategoryId, @MinPrice, @MaxPrice", "Фильтрация каталога"],
    ["pr_CreateOrder", "@CustomerId, @ItemsJson", "Создание заказа из JSON"],
    ["pr_UpdateOrderStatus", "@OrderId, @Status", "Изменение статуса"],
    ["pr_RegisterUser", "@Login, @PasswordHash, @Role, @CustomerId", "Создание пользователя"]
  ]);

setTable(10,
  ["Функция", "Параметры", "Возвращаемое значение"],
  [
    ["fn_GetOrderTotal", "@OrderId", "DECIMAL — сумма заказа"],
    ["fn_IsInStock", "@ProductId", "BIT — наличие товара"],
    ["fn_GetCustomerOrderCount", "@CustomerId", "INT — число заказов"]
  ]);

setTable(11,
  ["№", "Назначение", "Ключевые параметры"],
  [
    ["1", "Получить каталог", "@CategoryId, @MinPrice, @MaxPrice"],
    ["2", "Получить товар", "@ProductId"],
    ["3", "Проверить уникальность регистрации", "@Login, @Email"],
    ["4", "Найти пользователя для входа", "@Identity"],
    ["5", "Создать сессию", "@UserId, @TokenHash, @ExpiresAt"],
    ["6", "Проверить сессию", "@TokenHash"],
    ["7", "Завершить сессию", "@TokenHash"],
    ["8", "Обновить дату входа", "@UserId"],
    ["9", "Получить заказы клиента", "@CustomerId"],
    ["10", "Получить состав заказа", "@OrderId"]
  ]);

setTable(13,
  ["Ситуация", "Текст сообщения", "Тип"],
  [
    ["Регистрация", "Переход в личный кабинет", "Успех"],
    ["Занятый логин или email", "Пользователь уже существует.", "Ошибка 409"],
    ["Короткий пароль", "Пароль должен содержать от 8 символов.", "Ошибка 400"],
    ["Успешный вход", "Переход в личный кабинет", "Успех"],
    ["Неверные данные", "Неверный логин, email или пароль.", "Ошибка 401"],
    ["Нет сессии", "Переход на страницу входа", "Авторизация"],
    ["Сервер недоступен", "Сервер авторизации недоступен.", "Ошибка"],
    ["Выход", "Сессия удалена", "204 No Content"]
  ]);

setTable(14,
  ["Уровень", "Компоненты", "Функции"],
  [
    ["Клиентский", "HTML, CSS, script.js", "Интерфейс, корзина, формы"],
    ["Серверный", "Express, bcryptjs, cookie-parser", "Валидация, API, сессии"],
    ["Данных", "SQL Server 2022, mssql/msnodesqlv8", "Users, Sessions и предметная модель"]
  ]);

setTable(15,
  ["Родительская", "Тип", "Дочерняя", "Обяз.", "Роль связи"],
  [
    ["Categories", "1:N", "Products", "Да", "Категория товара"],
    ["Categories", "1:N", "Categories", "Нет", "Иерархия"],
    ["Customers", "1:N", "Orders", "Да", "Заказчик"],
    ["Orders", "1:N", "OrderItems", "Да", "Состав заказа"],
    ["Products", "1:N", "OrderItems", "Да", "Товар"],
    ["Orders", "1:N", "Payments", "Да", "Платёж"],
    ["Customers", "1:1", "Users", "Нет", "Профиль аккаунта"],
    ["Users", "1:N", "Sessions", "Да", "Серверные сессии"]
  ]);

setTable(16,
  ["Компонент", "Минимальная версия", "Назначение"],
  [
    ["MS SQL Server", "2022 Express (16.x)", "Хранение данных"],
    ["ODBC Driver", "17", "Подключение Node.js"],
    ["Node.js", "20", "Express-сервер"],
    ["npm", "10", "Зависимости и команды"],
    ["Браузер", "Современный", "Клиентская часть"],
    ["ОС", "Windows 10/11 или Server", "Windows Authentication"],
    ["Дисковое пространство", "Не менее 2 ГБ", "SQL Server и проект"],
    ["Оперативная память", "Не менее 4 ГБ", "SQL Server и Node.js"]
  ]);

const settingsFile = zip.file("word/settings.xml");
if (settingsFile) {
  const settings = parser.parseFromString(settingsFile.asText(), "application/xml");
  const root = settings.documentElement;
  let updateFields = descendants(settings, "updateFields")[0];
  if (!updateFields) {
    updateFields = settings.createElementNS(W, "w:updateFields");
    root.appendChild(updateFields);
  }
  updateFields.setAttributeNS(W, "w:val", "true");
  zip.file("word/settings.xml", serializer.serializeToString(settings));
}

zip.file("word/document.xml", serializer.serializeToString(documentXml));
await fs.writeFile(outputPath, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));

console.log(JSON.stringify({ outputPath, missingParagraphs, tables: descendants(documentXml, "tbl").length }));

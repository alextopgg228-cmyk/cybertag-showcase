const rootPath = document.body.dataset.root || "";
const asset = (path) => `${rootPath}${path}`;
const currency = new Intl.NumberFormat("ru-RU");
let currentUser = null;

const apiUrl = (endpoint) => new URL(`${rootPath}api${endpoint}`, window.location.href).toString();
const demoUsersKey = "cybertag-demo-auth-users";
const demoCurrentUserKey = "cybertag-demo-auth-current";
const demoOrdersKey = "cybertag-demo-orders";
const demoPromotionsKey = "cybertag-demo-promotions";
const orderStatusLabels = {
  new: "Новый",
  processing: "В работе",
  shipped: "Отправлен",
  done: "Завершён",
  cancelled: "Отменён"
};

const isGithubPagesAuth = () => window.location.hostname.endsWith("github.io");

const publicDemoUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: user.role
});

const demoPasswordHash = async (password) => {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(`cybertag-demo:${password}`);
    const hash = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let hash = 0;
  for (const char of String(password)) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return String(hash);
};

const parseApiBody = (options) => {
  try {
    return JSON.parse(options.body || "{}");
  } catch {
    return {};
  }
};

const getDemoUsers = async () => {
  const users = storage.get(demoUsersKey, []);
  if (users.some((user) => user.username === "manager")) return users;

  const seededUsers = [
    ...users,
    {
      id: 1,
      username: "manager",
      name: "Менеджер CYBERTAG",
      email: "manager@cybertag.local",
      role: "admin",
      passwordHash: await demoPasswordHash("cybertag2026")
    }
  ];
  storage.set(demoUsersKey, seededUsers);
  return seededUsers;
};

const getDemoCurrentUser = async () => {
  const users = await getDemoUsers();
  const userId = storage.get(demoCurrentUserKey, null);
  return users.find((candidate) => candidate.id === userId) || null;
};

const requireDemoUser = async () => {
  const user = await getDemoCurrentUser();
  if (!user) throw new Error("Требуется авторизация.");
  return user;
};

const requireDemoAdmin = async () => {
  const user = await requireDemoUser();
  if (user.role !== "admin") throw new Error("Недостаточно прав.");
  return user;
};

const getDemoPromotions = () => {
  const saved = storage.get(demoPromotionsKey, null);
  if (Array.isArray(saved)) return saved;
  const seeded = offers.map((offer, index) => ({ ...offer, id: index + 1, active: true }));
  storage.set(demoPromotionsKey, seeded);
  return seeded;
};

const demoApi = async (endpoint, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();

  if (endpoint === "/auth/me" && method === "GET") {
    const user = await getDemoCurrentUser();
    return { user: user ? publicDemoUser(user) : null };
  }

  if (endpoint === "/auth/logout" && method === "POST") {
    storage.remove(demoCurrentUserKey);
    return {};
  }

  if (endpoint === "/auth/login" && method === "POST") {
    const body = parseApiBody(options);
    const identity = String(body.identity || "").trim().toLowerCase();
    const passwordHash = await demoPasswordHash(String(body.password || ""));
    const users = await getDemoUsers();
    const user = users.find((candidate) =>
      candidate.username.toLowerCase() === identity || candidate.email.toLowerCase() === identity
    );

    if (!user || user.passwordHash !== passwordHash) {
      throw new Error("Неверный логин, email или пароль.");
    }

    storage.set(demoCurrentUserKey, user.id);
    return { user: publicDemoUser(user) };
  }

  if (endpoint === "/auth/register" && method === "POST") {
    const body = parseApiBody(options);
    const fullName = String(body.fullName || "").trim();
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (fullName.length < 2 || fullName.length > 100) {
      throw new Error("Укажите имя длиной от 2 до 100 символов.");
    }
    if (!/^[A-Za-zА-Яа-яЁё0-9_.-]{3,32}$/.test(username)) {
      throw new Error("Логин должен содержать от 3 до 32 букв, цифр, точек, дефисов или подчёркиваний.");
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Укажите корректный email.");
    }
    if (password.length < 8 || password.length > 128) {
      throw new Error("Пароль должен содержать от 8 до 128 символов.");
    }

    const users = await getDemoUsers();
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase() || user.email === email)) {
      throw new Error("Пользователь с таким логином или email уже существует.");
    }

    const user = {
      id: Math.max(0, ...users.map((candidate) => candidate.id)) + 1,
      username,
      name: fullName,
      email,
      role: "customer",
      passwordHash: await demoPasswordHash(password)
    };
    storage.set(demoUsersKey, [...users, user]);
    storage.set(demoCurrentUserKey, user.id);
    return { user: publicDemoUser(user) };
  }

  if (endpoint === "/promotions" && method === "GET") {
    return { promotions: getDemoPromotions().filter((promotion) => promotion.active !== false) };
  }

  if (endpoint === "/orders" && method === "POST") {
    const user = await requireDemoUser();
    const body = parseApiBody(options);
    const requestedItems = Array.isArray(body.items) ? body.items : [];
    const grouped = new Map();
    requestedItems.forEach((item) => {
      const title = String(item?.title || "").trim();
      const qty = Math.max(1, Math.min(20, Number(item?.qty) || 1));
      if (title) grouped.set(title, Math.min(20, (grouped.get(title) || 0) + qty));
    });
    const items = Array.from(grouped, ([title, qty]) => {
      const bundle = bundles.find((candidate) => candidate.title === title);
      return bundle ? { title, qty, price: bundle.price } : null;
    }).filter(Boolean);
    if (!items.length || items.length !== grouped.size) {
      throw new Error("Корзина не содержит допустимых товаров.");
    }

    const orders = storage.get(demoOrdersKey, []);
    const order = {
      id: Math.max(0, ...orders.map((candidate) => candidate.id)) + 1,
      orderDate: new Date().toISOString(),
      status: "new",
      totalAmount: items.reduce((sum, item) => sum + item.price * item.qty, 0),
      customerName: user.name,
      customerEmail: user.email,
      itemCount: items.reduce((sum, item) => sum + item.qty, 0),
      items: items.map((item) => `${item.title} × ${item.qty}`).join(", ")
    };
    storage.set(demoOrdersKey, [order, ...orders]);
    return { order };
  }

  if (endpoint === "/admin/orders" && method === "GET") {
    await requireDemoAdmin();
    return { orders: storage.get(demoOrdersKey, []) };
  }

  const statusMatch = endpoint.match(/^\/admin\/orders\/(\d+)\/status$/);
  if (statusMatch && method === "PATCH") {
    await requireDemoAdmin();
    const body = parseApiBody(options);
    if (!Object.hasOwn(orderStatusLabels, body.status)) throw new Error("Некорректный статус заказа.");
    const orderId = Number(statusMatch[1]);
    const orders = storage.get(demoOrdersKey, []);
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) throw new Error("Заказ не найден.");
    order.status = body.status;
    storage.set(demoOrdersKey, orders);
    return { order: { id: order.id, status: order.status } };
  }

  if (endpoint === "/admin/promotions" && method === "POST") {
    await requireDemoAdmin();
    const body = parseApiBody(options);
    const promotions = getDemoPromotions();
    const promotion = {
      id: Math.max(0, ...promotions.map((candidate) => candidate.id)) + 1,
      title: String(body.title || "").trim(),
      text: String(body.description || "").trim(),
      date: String(body.dateLabel || "").trim(),
      image: String(body.imageUrl || "assets/offer-crm.jpg").trim(),
      active: true,
      createdAt: new Date().toISOString()
    };
    if (promotion.title.length < 3 || promotion.text.length < 10 || promotion.date.length < 2) {
      throw new Error("Заполните название, описание и срок действия акции.");
    }
    storage.set(demoPromotionsKey, [promotion, ...promotions]);
    return { promotion };
  }

  const promotionDeleteMatch = endpoint.match(/^\/admin\/promotions\/(\d+)$/);
  if (promotionDeleteMatch && method === "DELETE") {
    await requireDemoAdmin();
    const promotionId = Number(promotionDeleteMatch[1]);
    const promotions = getDemoPromotions();
    const promotion = promotions.find((candidate) => candidate.id === promotionId && candidate.active !== false);
    if (!promotion) throw new Error("Акция не найдена.");
    promotion.active = false;
    storage.set(demoPromotionsKey, promotions);
    return { promotion: { id: promotion.id, active: false } };
  }

  throw new Error("Сервер авторизации недоступен.");
};

const requestApi = async (endpoint, options = {}) => {
  if (isGithubPagesAuth()) {
    return demoApi(endpoint, options);
  }

  const response = await fetch(apiUrl(endpoint), {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new Error(body?.error || "Сервер авторизации недоступен.");
  }
  return body;
};

const partners = [
  ["LASERWAR", "assets/partner-lw.svg", "https://laserwar.ru"],
  ["CyberTag", "assets/partner-cybertag.svg", "https://cybertag.ru"],
  ["LaserArena", "assets/partner-laserarena.svg", "https://laserarena.ru"],
  ["Майские Маневры", "assets/partner-may-maneuvers.png", "https://maymanevry.ru"],
  ["Laserwar CRM", "assets/partner-crm.svg", "https://laserwar.club"],
  ["Лазертаг Биатлон", "assets/partner-biathlon.svg", "http://laserbiatlon.ru"],
  ["ZombieTag", "assets/partner-zombietag.svg", "https://zombie-lasertag.ru"],
  ["Федерация лазертага", "assets/partner-federation.png", "https://lasertag-federation.ru"],
  ["Alphatag", "assets/partner-alpha.svg", "http://alphatag.ru"],
  ["Laser tag base", "assets/partner-base.svg", "https://lasertagbase.com"]
];

const equipment = [
  {
    title: "Бластер",
    image: "assets/catalog-blaster.jpg",
    meta: ["0,8 кг", "мощность 1-100%"],
    text: "Компактный корпус одинаково удобен детям и взрослым. Сенсоры в бластере и датчик второй руки повышают безопасность игры.",
    details: ["Емкий аккумулятор до 24 часов", "Мягкий бампер на стволе", "Эргономичные рукоятки"]
  },
  {
    title: "Жилет",
    image: "assets/catalog-vest.jpg",
    meta: ["1,0 кг", "индивидуальная регулировка"],
    text: "Легкий прочный жилет не стесняет движений и подстраивается под игроков разной комплекции.",
    details: ["Гигиеническая подкладка", "10 датчиков поражения", "Световая и виброиндикация"]
  },
  {
    title: "BASEX",
    image: "assets/catalog-basex.jpg",
    meta: ["0,5 кг", "интерактивность"],
    text: "Игровое устройство связывает площадку в единую систему и помогает строить сценарии на всей территории.",
    details: ["RGB-индикация", "Встроенный радиоканал", "Удобный монтаж"]
  },
  {
    title: "Энерджайзер",
    image: "assets/catalog-energizer.jpg",
    meta: ["0,4 кг", "новые сценарии"],
    text: "Интерактивное устройство для восстановления жизненных сил и боекомплекта во время игры.",
    details: ["Яркая RGB-индикация", "Прочный корпус", "Светящаяся кнопка"]
  },
  {
    title: "Радиобаза",
    image: "assets/catalog-radiobase.jpg",
    meta: ["0,3 кг", "радиопокрытие"],
    text: "Радиобаза поддерживает стабильную связь игровых комплектов и локальной сети площадки.",
    details: ["Внешняя антенна", "Сетевой порт", "Компактный корпус"]
  }
];

const bundles = [
  {
    title: "Start",
    image: "assets/bundle-start.png",
    players: 12,
    area: "до 200 м²",
    sets: "x12",
    oldPrice: 823900,
    price: 695500,
    badge: "Бонус",
    details: ["2 комплекта бластер + жилет", "Программное обеспечение", "Зарядное устройство Smart Li+ - 16 шт.", "Блок питания 12В - 4 шт.", "Ремкомплект - 1 шт."]
  },
  {
    title: "Optima Wireless",
    image: "assets/bundle-optima.png",
    players: 18,
    area: "до 300 м²",
    sets: "x18",
    oldPrice: 1209100,
    price: 1016500,
    badge: "Хит продаж",
    hit: true,
    details: ["3 комплекта бластер + жилет", "Зарядное устройство Smart Li+ - 22 шт.", "15 жилетов и 15 бластеров", "Радиобаза и BASEX"]
  },
  {
    title: "Smart",
    image: "assets/bundle-smart.png",
    players: 24,
    area: "до 400 м²",
    sets: "x24",
    oldPrice: 1644650,
    price: 1387850,
    badge: "4 комплекта в подарок",
    details: ["Программное обеспечение в подарок", "Зарядное устройство Smart Li+ - 32 шт.", "Блок питания 12В - 6 шт.", "20 жилетов и 20 бластеров", "3 устройства BASEX и энерджайзер"]
  },
  {
    title: "Pro",
    image: "assets/bundle-pro.png",
    players: 30,
    area: "до 600 м²",
    sets: "x30",
    oldPrice: 2029850,
    price: 1708850,
    badge: "5 комплектов",
    details: ["Зарядное устройство Smart Li+ - 38 шт.", "Ремкомплект - 2 шт.", "25 жилетов и 25 бластеров", "Расширенный набор интерактива"]
  },
  {
    title: "Elite",
    image: "assets/bundle-elite.png",
    players: 36,
    area: "до 1000 м²",
    sets: "x36",
    oldPrice: 2453600,
    price: 2068400,
    badge: "6 комплектов",
    details: ["Зарядное устройство Smart Li+ - 47 шт.", "Блок питания 12В - 8 шт.", "30 жилетов и 30 бластеров", "4 устройства BASEX и энерджайзер"]
  }
];

const offers = [
  {
    title: "Уникальное предложение по апгрейду арены",
    image: "assets/offer-laserwar.jpg",
    date: "Июн 14, 2026 - Июн 14, 2027",
    code: "2762",
    text: "Обновление действующей площадки до CYBERTAG 2.0 Black Edition для тех, кому нужен новый уровень игры."
  },
  {
    title: "CRM-система для лазертага в подарок",
    image: "assets/offer-crm.jpg",
    date: "Июн 14, 2026 - Июн 14, 2027",
    code: "2852",
    text: "При покупке любой комплектации CYBERTAG доступ к Laserwar CRM предоставляется на три месяца."
  },
  {
    title: "Франшиза для лазертаг-клуба в подарок",
    image: "assets/offer-franchise.jpg",
    date: "Июн 14, 2026 - Июн 14, 2027",
    code: "3221",
    text: "Пакет материалов для бизнеса бесплатно при покупке комплекта оборудования для аренного лазертага."
  }
];

const contacts = [
  { name: "Алина Данченкова", role: "Менеджер по продажам", phone: "+7 (900) 225-55-52", tel: "+79002255552", vk: "https://vk.com/laserwar_order67", image: "assets/contact-alina.jpg" },
  { name: "Дарья Кузьменкова", role: "Менеджер по продажам", phone: "+7 (904) 360-40-99", tel: "+79043604099", vk: "https://vk.com/lw_manager", image: "assets/contact-darya.jpg" },
  { name: "Наталья Орлова", role: "Менеджер по продажам", phone: "+7 (951) 694-01-00", tel: "+79516940100", vk: "https://vk.com/laserwar_store", image: "assets/contact-natalia.jpg" },
  { name: "Елена Крылова", role: "Менеджер по продажам", phone: "+7 (951) 701-77-55", tel: "+79517017755", vk: "https://vk.com/laserwar_shop", image: "assets/contact-elena.jpg" }
];

const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

const formatPrice = (value) => `${currency.format(value)} ₽`;
const formatDate = (value) => new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short"
}).format(new Date(value));
const formatPromotionDate = (value) => new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC"
}).format(new Date(`${value}T00:00:00Z`));
const formatPromotionDateRange = (startDate, endDate) => startDate === endDate
  ? formatPromotionDate(startDate)
  : `${formatPromotionDate(startDate)} - ${formatPromotionDate(endDate)}`;
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const promotionImage = (value) => {
  const image = String(value || "");
  if (/^https:\/\//i.test(image)) return image;
  return asset(/^assets\/[A-Za-z0-9._/-]+$/.test(image) ? image : "assets/offer-crm.jpg");
};

const renderPartners = () => {
  const root = document.querySelector("[data-partners]");
  if (!root) return;
  root.innerHTML = partners.map(([name, image, href]) => `
    <a href="${href}" target="_blank" rel="noreferrer" aria-label="${name}">
      <img src="${asset(image)}" alt="${name}" loading="lazy">
    </a>
  `).join("");
};

const renderEquipment = () => {
  const root = document.querySelector("[data-equipment]");
  if (!root) return;
  root.innerHTML = equipment.map((item) => `
    <article class="equipment-card">
      <img src="${asset(item.image)}" alt="${item.title}" loading="lazy">
      <div class="card-body">
        <div class="equipment-meta">${item.meta.map((meta) => `<span class="pill">${meta}</span>`).join("")}</div>
        <h3>${item.title}</h3>
        <p>${item.text}</p>
        <ul>${item.details.map((detail) => `<li>${detail}</li>`).join("")}</ul>
      </div>
    </article>
  `).join("");
};

const renderBundles = () => {
  const root = document.querySelector("[data-bundles]");
  if (!root) return;
  root.innerHTML = bundles.map((bundle) => `
    <article class="bundle-card${bundle.hit ? " hit" : ""}">
      <div class="bundle-image">
        <img src="${asset(bundle.image)}" alt="${bundle.title}" loading="lazy">
        <span class="badge">${bundle.badge}</span>
      </div>
      <div class="bundle-body">
        <div class="bundle-topline"><h3>${bundle.title}</h3><span>${bundle.sets}</span></div>
        <dl class="bundle-facts">
          <div><dt>Игроков</dt><dd>${bundle.players}</dd></div>
          <div><dt>Площадь</dt><dd>${bundle.area}</dd></div>
        </dl>
        <ul>${bundle.details.map((detail) => `<li>${detail}</li>`).join("")}</ul>
        <div class="price-row"><span class="old-price">${formatPrice(bundle.oldPrice)}</span><span class="new-price">${formatPrice(bundle.price)}</span></div>
        <button class="button primary" type="button" data-add-bundle="${bundle.title}">В корзину</button>
      </div>
    </article>
  `).join("");
};

const renderOffers = async () => {
  const root = document.querySelector("[data-offers]");
  if (!root) return;
  let promotions = offers;
  try {
    const result = await requestApi("/promotions");
    if (Array.isArray(result.promotions)) promotions = result.promotions;
  } catch {
    promotions = offers;
  }
  root.innerHTML = promotions.map((offer, index) => `
    <article class="offer-card">
      <img src="${escapeHtml(promotionImage(offer.image))}" alt="${escapeHtml(offer.title)}" loading="lazy">
      <div class="card-body">
        <div class="offer-date"><span>${escapeHtml(offer.date)}</span><span class="offer-code">ID ${escapeHtml(offer.id || offer.code || index + 1)}</span></div>
        <h3>${escapeHtml(offer.title)}</h3>
        <p>${escapeHtml(offer.text)}</p>
      </div>
    </article>
  `).join("");
};

const renderContacts = () => {
  const root = document.querySelector("[data-contacts]");
  if (!root) return;
  root.innerHTML = contacts.map((contact) => `
    <article class="contact-card">
      <img src="${asset(contact.image)}" alt="${contact.name}" loading="lazy">
      <h3>${contact.name}</h3>
      <p>${contact.role}</p>
      <strong>${contact.phone}</strong>
      <div class="contact-links">
        <a href="tel:${contact.tel}">Позвонить</a>
        <a href="https://wa.me/${contact.tel.replace("+", "")}" target="_blank" rel="noreferrer">WhatsApp</a>
        <a href="https://t.me/${contact.tel}" target="_blank" rel="noreferrer">Telegram</a>
        <a href="${contact.vk}" target="_blank" rel="noreferrer">VK</a>
      </div>
    </article>
  `).join("");
};

const getCart = () => storage.get("cybertag-cart", []);
const getUser = () => currentUser;
const getRequests = () => storage.get("cybertag-requests", []);

const refreshCurrentUser = async () => {
  try {
    const result = await requestApi("/auth/me");
    currentUser = result.user;
  } catch {
    currentUser = null;
  }
};

const setCart = (cart) => {
  storage.set("cybertag-cart", cart);
  renderCart();
};

const getCartMessage = () => {
  const cart = getCart();
  return cart.length
    ? `Хочу оформить заказ: ${cart.map((item) => item.title).join(", ")}.`
    : "Хочу оформить заказ.";
};

const getOrderItems = (cart) => {
  const grouped = new Map();
  cart.forEach((item) => grouped.set(item.title, (grouped.get(item.title) || 0) + 1));
  return Array.from(grouped, ([title, qty]) => ({ title, qty }));
};

const renderCart = () => {
  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const countText = `${cart.length} ${cart.length === 1 ? "позиция" : cart.length > 1 && cart.length < 5 ? "позиции" : "позиций"}`;

  document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = countText; });
  document.querySelectorAll("[data-cart-total], [data-dashboard-cart]").forEach((node) => { node.textContent = formatPrice(total); });
  document.querySelectorAll("[data-cart-badge]").forEach((node) => {
    node.textContent = cart.length > 99 ? "99+" : String(cart.length);
  });
  document.querySelectorAll("[data-checkout], [data-clear-cart]").forEach((button) => {
    button.disabled = cart.length === 0;
  });

  const list = document.querySelector("[data-cart-list]");
  const empty = document.querySelector("[data-cart-empty]");
  if (!list) return;

  if (!cart.length) {
    list.innerHTML = list.hasAttribute("data-cart-detailed") ? "" : "<li><span>Корзина пуста</span></li>";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  if (list.hasAttribute("data-cart-detailed")) {
    list.innerHTML = cart.map((item, index) => {
      const bundle = bundles.find((entry) => entry.title === item.title);
      const image = bundle ? asset(bundle.image) : asset("assets/top_logotype.svg");
      return `
        <li class="cart-page-item">
          <img src="${image}" alt="${item.title}">
          <div>
            <span>Комплект оборудования</span>
            <strong>${item.title}</strong>
          </div>
          <b>${formatPrice(item.price)}</b>
          <button class="cart-remove" type="button" data-remove-cart-index="${index}" aria-label="Удалить ${item.title}">×</button>
        </li>
      `;
    }).join("");
    return;
  }

  list.innerHTML = cart.map((item) => `
    <li><span>${item.title}</span><strong>${formatPrice(item.price)}</strong></li>
  `).join("");
};

const addBundleToCart = (title) => {
  const bundle = bundles.find((item) => item.title === title);
  if (!bundle) return;
  setCart([...getCart(), { title: bundle.title, price: bundle.price }]);
};

const checkout = () => {
  const status = document.querySelector("[data-cart-status]");
  if (!getCart().length) {
    if (status) status.textContent = "Добавьте комплект перед оформлением.";
    return;
  }

  if (!getUser()) {
    storage.set("cybertag-checkout-pending", true);
    if (status) status.textContent = "Для оформления войдите в аккаунт.";
    window.location.href = `${rootPath}login/?next=checkout`;
    return;
  }

  const form = document.querySelector("[data-feedback-form]");
  if (form) {
    form.elements.message.value = getCartMessage();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    storage.remove("cybertag-checkout-pending");
    if (status) {
      status.textContent = "Заполните контактные данные в форме.";
      status.classList.add("success");
    }
    return;
  }

  storage.set("cybertag-checkout-pending", true);
  window.location.href = `${rootPath}kontakty/?checkout=1#feedback`;
};

const renderDashboard = () => {
  const user = getUser();
  const loginLinks = document.querySelectorAll("[data-login-link]");
  const dashboard = document.querySelector("[data-dashboard]");
  const requestCount = document.querySelector("[data-request-count]");
  const userName = document.querySelector("[data-user-name]");
  const adminLinks = document.querySelectorAll("[data-admin-link]");

  loginLinks.forEach((link) => {
    link.textContent = user ? user.username : "Войти";
    link.href = user
      ? `${rootPath}${user.role === "admin" ? "admin/" : "kontakty/"}`
      : `${rootPath}login/`;
  });
  adminLinks.forEach((link) => { link.hidden = user?.role !== "admin"; });
  if (dashboard) dashboard.hidden = !user;
  if (userName && user) userName.textContent = user.name;
  if (requestCount) requestCount.textContent = String(getRequests().length);
  renderCart();
};

const setupMenu = () => {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-nav]");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => document.body.classList.toggle("menu-open"));
  nav.addEventListener("click", (event) => {
    if (event.target.matches("a, button")) document.body.classList.remove("menu-open");
  });

  const current = location.pathname.replace(/\/index\.html$/, "/");
  nav.querySelectorAll("a").forEach((link) => {
    const url = new URL(link.getAttribute("href"), location.href);
    if (url.pathname.replace(/\/index\.html$/, "/") === current) link.classList.add("active");
  });
};

const setupCart = () => {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-bundle]");
    if (button) {
      addBundleToCart(button.dataset.addBundle);
      return;
    }

    const removeButton = event.target.closest("[data-remove-cart-index]");
    if (!removeButton) return;
    const index = Number(removeButton.dataset.removeCartIndex);
    setCart(getCart().filter((_, itemIndex) => itemIndex !== index));
  });

  document.querySelectorAll("[data-clear-cart]").forEach((button) => {
    button.addEventListener("click", () => setCart([]));
  });

  document.querySelectorAll("[data-checkout]").forEach((button) => {
    button.addEventListener("click", checkout);
  });
};

const setupFeedback = () => {
  const form = document.querySelector("[data-feedback-form]");
  const status = document.querySelector("[data-feedback-status]");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const cart = getCart();
    if (status) {
      status.textContent = "";
      status.classList.remove("success");
    }
    setFormBusy(form, true);

    try {
      let order = null;
      if (cart.length) {
        if (!getUser()) throw new Error("Для оформления заказа войдите в аккаунт.");
        const result = await requestApi("/orders", {
          method: "POST",
          body: JSON.stringify({ items: getOrderItems(cart) })
        });
        order = result.order;
      }

      const requests = getRequests();
      requests.push({
        email: data.get("email"),
        name: data.get("name"),
        message: data.get("message"),
        cart,
        orderId: order?.id || null,
        createdAt: new Date().toISOString()
      });
      storage.set("cybertag-requests", requests);
      storage.remove("cybertag-checkout-pending");
      if (order) setCart([]);
      form.reset();
      if (status) {
        status.textContent = order ? `Заказ №${order.id} сохранён.` : "Заявка сохранена.";
        status.classList.add("success");
      }
      renderDashboard();
    } catch (requestError) {
      if (status) status.textContent = requestError.message;
    } finally {
      setFormBusy(form, false);
    }
  });

  if (location.hash === "#feedback") {
    if (getUser() && storage.get("cybertag-checkout-pending", false) && getCart().length) {
      form.elements.message.value = getCartMessage();
      storage.remove("cybertag-checkout-pending");
      if (status) {
        status.textContent = "Состав заказа добавлен в сообщение.";
        status.classList.add("success");
      }
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const redirectAfterAuth = () => {
  const next = new URLSearchParams(location.search).get("next");
  if (next === "checkout") {
    window.location.href = `${rootPath}kontakty/?checkout=1#feedback`;
    return;
  }
  window.location.href = currentUser?.role === "admin" || next === "admin"
    ? `${rootPath}admin/`
    : `${rootPath}kontakty/`;
};

const setFormBusy = (form, busy) => {
  form.querySelectorAll("input, button, select, textarea").forEach((control) => {
    control.disabled = busy;
  });
};

const renderAdminOrders = (orders) => {
  const root = document.querySelector("[data-admin-orders]");
  if (!root) return;
  if (!orders.length) {
    root.innerHTML = '<tr><td colspan="6" class="admin-empty">Заказов пока нет.</td></tr>';
    return;
  }

  root.innerHTML = orders.map((order) => `
    <tr>
      <td><strong>№${escapeHtml(order.id)}</strong><span>${escapeHtml(formatDate(order.orderDate))}</span></td>
      <td><strong>${escapeHtml(order.customerName)}</strong><span>${escapeHtml(order.customerEmail)}</span></td>
      <td>${escapeHtml(order.items || "—")}</td>
      <td>${escapeHtml(order.itemCount)}</td>
      <td><strong>${escapeHtml(formatPrice(order.totalAmount))}</strong></td>
      <td>
        <select data-order-status="${escapeHtml(order.id)}" data-previous-status="${escapeHtml(order.status)}" aria-label="Статус заказа №${escapeHtml(order.id)}">
          ${Object.entries(orderStatusLabels).map(([value, label]) => `
            <option value="${value}"${value === order.status ? " selected" : ""}>${label}</option>
          `).join("")}
        </select>
      </td>
    </tr>
  `).join("");
};

const renderAdminPromotions = (promotions) => {
  const root = document.querySelector("[data-admin-promotions]");
  if (!root) return;
  root.innerHTML = promotions.length
    ? promotions.map((promotion) => `
      <li>
        <div>
          <strong>${escapeHtml(promotion.title)}</strong>
          <span>${escapeHtml(promotion.date)}</span>
        </div>
        <button class="button danger compact" type="button" data-promotion-delete="${escapeHtml(promotion.id)}">Удалить</button>
      </li>
    `).join("")
    : "<li>Акций пока нет.</li>";
};

const loadAdminData = async () => {
  const status = document.querySelector("[data-admin-status]");
  if (status) status.textContent = "Обновление данных...";
  try {
    const [ordersResult, promotionsResult] = await Promise.all([
      requestApi("/admin/orders"),
      requestApi("/promotions")
    ]);
    renderAdminOrders(ordersResult.orders || []);
    renderAdminPromotions(promotionsResult.promotions || []);
    if (status) status.textContent = `Заказов: ${(ordersResult.orders || []).length}`;
  } catch (error) {
    if (status) status.textContent = error.message;
  }
};

const setupAdmin = async () => {
  const shell = document.querySelector("[data-admin-shell]");
  const root = document.querySelector("[data-admin-root]");
  if (!root) return;

  if (!getUser()) {
    window.location.href = `${rootPath}login/?next=admin`;
    return;
  }
  if (getUser().role !== "admin") {
    window.location.replace(`${rootPath}kontakty/`);
    return;
  }

  if (shell) shell.hidden = false;
  root.hidden = false;
  const promotionForm = document.querySelector("[data-promotion-form]");
  const promotionStatus = document.querySelector("[data-promotion-status]");
  const ordersTable = document.querySelector("[data-admin-orders-table]");
  const startDateInput = promotionForm?.elements.startDate;
  const endDateInput = promotionForm?.elements.endDate;

  const syncPromotionDateRange = () => {
    if (!startDateInput || !endDateInput) return;
    endDateInput.min = startDateInput.value;
    endDateInput.setCustomValidity(
      startDateInput.value && endDateInput.value && endDateInput.value < startDateInput.value
        ? "Дата окончания не может быть раньше даты начала."
        : ""
    );
  };

  startDateInput?.addEventListener("change", syncPromotionDateRange);
  endDateInput?.addEventListener("change", syncPromotionDateRange);

  promotionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncPromotionDateRange();
    if (!promotionForm.reportValidity()) return;
    const data = new FormData(promotionForm);
    const startDate = String(data.get("startDate"));
    const endDate = String(data.get("endDate"));
    if (promotionStatus) {
      promotionStatus.textContent = "";
      promotionStatus.classList.remove("success");
    }
    setFormBusy(promotionForm, true);
    try {
      const result = await requestApi("/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          title: String(data.get("title")).trim(),
          description: String(data.get("description")).trim(),
          dateLabel: formatPromotionDateRange(startDate, endDate),
          imageUrl: String(data.get("imageUrl")).trim()
        })
      });
      promotionForm.reset();
      if (promotionStatus) {
        promotionStatus.textContent = `Акция «${result.promotion.title}» добавлена.`;
        promotionStatus.classList.add("success");
      }
      await loadAdminData();
    } catch (error) {
      if (promotionStatus) promotionStatus.textContent = error.message;
    } finally {
      setFormBusy(promotionForm, false);
    }
  });

  ordersTable?.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-order-status]");
    if (!select) return;
    const previousStatus = select.dataset.previousStatus;
    select.disabled = true;
    try {
      await requestApi(`/admin/orders/${select.dataset.orderStatus}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value })
      });
      select.dataset.previousStatus = select.value;
    } catch (error) {
      select.value = previousStatus;
      const status = document.querySelector("[data-admin-status]");
      if (status) status.textContent = error.message;
    } finally {
      select.disabled = false;
    }
  });

  document.querySelector("[data-admin-promotions]")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-promotion-delete]");
    if (!button) return;
    if (!window.confirm("Удалить эту акцию?")) return;
    button.disabled = true;
    try {
      await requestApi(`/admin/promotions/${button.dataset.promotionDelete}`, { method: "DELETE" });
      await loadAdminData();
    } catch (error) {
      const status = document.querySelector("[data-admin-status]");
      if (status) status.textContent = error.message;
      button.disabled = false;
    }
  });

  document.querySelector("[data-admin-refresh]")?.addEventListener("click", loadAdminData);
  await loadAdminData();
};

const setupAuth = () => {
  const form = document.querySelector("[data-login-page-form]");
  const error = document.querySelector("[data-login-error]");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      if (error) error.textContent = "";
      setFormBusy(form, true);
      try {
        const result = await requestApi("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identity: String(data.get("identity")).trim(),
            password: String(data.get("password"))
          })
        });
        currentUser = result.user;
        form.reset();
        redirectAfterAuth();
      } catch (requestError) {
        if (error) error.textContent = requestError.message;
      } finally {
        setFormBusy(form, false);
      }
    });
  }

  const registerForm = document.querySelector("[data-register-form]");
  const registerError = document.querySelector("[data-register-error]");
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(registerForm);
      const password = String(data.get("password"));
      if (registerError) registerError.textContent = "";
      if (password !== String(data.get("passwordConfirm"))) {
        if (registerError) registerError.textContent = "Пароли не совпадают.";
        return;
      }

      setFormBusy(registerForm, true);
      try {
        const result = await requestApi("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            fullName: String(data.get("fullName")).trim(),
            username: String(data.get("username")).trim(),
            email: String(data.get("email")).trim(),
            password
          })
        });
        currentUser = result.user;
        registerForm.reset();
        redirectAfterAuth();
      } catch (requestError) {
        if (registerError) registerError.textContent = requestError.message;
      } finally {
        setFormBusy(registerForm, false);
      }
    });
  }

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await requestApi("/auth/logout", { method: "POST" });
      } finally {
        currentUser = null;
      }
      if (document.querySelector("[data-admin-root]")) {
        window.location.href = `${rootPath}login/?next=admin`;
        return;
      }
      renderDashboard();
    });
  });
};

const init = async () => {
  renderPartners();
  renderEquipment();
  renderBundles();
  await renderOffers();
  renderContacts();
  setupMenu();
  setupCart();
  await refreshCurrentUser();
  setupFeedback();
  setupAuth();
  renderDashboard();
  await setupAdmin();
};

init().catch((error) => console.error(error));

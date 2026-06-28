const rootPath = document.body.dataset.root || "";
const asset = (path) => `${rootPath}${path}`;
const currency = new Intl.NumberFormat("ru-RU");

const credentials = {
  username: "manager",
  password: "cybertag2026",
  name: "Менеджер CYBERTAG"
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

const renderOffers = () => {
  const root = document.querySelector("[data-offers]");
  if (!root) return;
  root.innerHTML = offers.map((offer) => `
    <article class="offer-card">
      <img src="${asset(offer.image)}" alt="${offer.title}" loading="lazy">
      <div class="card-body">
        <div class="offer-date"><span>${offer.date}</span><span class="offer-code">ID ${offer.code}</span></div>
        <h3>${offer.title}</h3>
        <p>${offer.text}</p>
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
const getUser = () => storage.get("cybertag-user", null);
const getRequests = () => storage.get("cybertag-requests", []);

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

  loginLinks.forEach((link) => {
    link.textContent = user ? user.username : "Войти";
    link.href = user ? `${rootPath}kontakty/` : `${rootPath}login/`;
  });
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const requests = getRequests();
    requests.push({
      email: data.get("email"),
      name: data.get("name"),
      message: data.get("message"),
      cart: getCart(),
      createdAt: new Date().toISOString()
    });
    storage.set("cybertag-requests", requests);
    storage.remove("cybertag-checkout-pending");
    form.reset();
    if (status) {
      status.textContent = "Заявка сохранена.";
      status.classList.add("success");
    }
    renderDashboard();
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

const setupLogin = () => {
  const form = document.querySelector("[data-login-page-form]");
  const error = document.querySelector("[data-login-error]");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const username = String(data.get("username")).trim();
      const password = String(data.get("password"));

      if (username === credentials.username && password === credentials.password) {
        storage.set("cybertag-user", { username: credentials.username, name: credentials.name });
        form.reset();
        const next = new URLSearchParams(location.search).get("next");
        window.location.href = next === "checkout"
          ? `${rootPath}kontakty/?checkout=1#feedback`
          : `${rootPath}kontakty/`;
      } else if (error) {
        error.textContent = "Неверный пользователь или пароль.";
      }
    });
  }

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => {
      storage.remove("cybertag-user");
      renderDashboard();
    });
  });
};

const init = () => {
  renderPartners();
  renderEquipment();
  renderBundles();
  renderOffers();
  renderContacts();
  setupMenu();
  setupCart();
  setupFeedback();
  setupLogin();
  renderDashboard();
};

init();

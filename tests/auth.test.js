import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

test("registration, orders and administrator workflow", async (t) => {
  const port = 34000 + Math.floor(Math.random() * 1000);
  const databaseName = `CybertagShopTest_${process.pid}`;
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DB_NAME: databaseName,
      SEED_DEMO_USER: "1",
      DEMO_ADMIN_PASSWORD: "cybertag2026",
      COOKIE_SECURE: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

  t.after(() => {
    server.kill();
    spawnSync("sqlcmd", [
      "-S", ".\\SQLEXPRESS",
      "-E",
      "-d", "master",
      "-Q", `IF DB_ID(N'${databaseName}') IS NOT NULL BEGIN ALTER DATABASE [${databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${databaseName}]; END`,
    ], { stdio: "ignore" });
  });

  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      healthy = response.ok;
      if (healthy) break;
    } catch {
      await delay(250);
    }
  }
  assert.equal(healthy, true, serverOutput);

  const guestAdminPage = await fetch(`${baseUrl}/admin/`, { redirect: "manual" });
  assert.equal(guestAdminPage.status, 302);
  assert.equal(guestAdminPage.headers.get("location"), "/login/?next=admin");

  const identity = `test_${Date.now()}`;
  const email = `${identity}@example.test`;
  const password = "StrongPassword42!";

  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Тестовый пользователь", username: identity, email, password }),
  });
  assert.equal(registerResponse.status, 201);
  const registered = await registerResponse.json();
  assert.equal(registered.user.username, identity);
  assert.equal(registered.user.email, email);

  const cookie = registerResponse.headers.get("set-cookie").split(";", 1)[0];
  const meResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).user.username, identity);

  const duplicateResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Другой пользователь", username: identity, email, password }),
  });
  assert.equal(duplicateResponse.status, 409);

  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logoutResponse.status, 204);

  const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, password: "wrong-password" }),
  });
  assert.equal(wrongPassword.status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });
  assert.equal(loginResponse.status, 200);
  const customerCookie = loginResponse.headers.get("set-cookie").split(";", 1)[0];
  assert.match(customerCookie, /^cybertag_session=/);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: customerCookie },
    body: JSON.stringify({ items: [{ title: "Start", qty: 1 }, { title: "Smart", qty: 2 }] }),
  });
  assert.equal(createOrderResponse.status, 201);
  const createdOrder = (await createOrderResponse.json()).order;
  assert.equal(createdOrder.status, "new");
  assert.equal(createdOrder.totalAmount, 3471200);

  const customerAdminResponse = await fetch(`${baseUrl}/api/admin/orders`, {
    headers: { Cookie: customerCookie },
  });
  assert.equal(customerAdminResponse.status, 403);

  const customerAdminPage = await fetch(`${baseUrl}/admin/`, {
    headers: { Cookie: customerCookie },
    redirect: "manual",
  });
  assert.equal(customerAdminPage.status, 302);
  assert.equal(customerAdminPage.headers.get("location"), "/");

  const adminLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "manager", password: "cybertag2026" }),
  });
  assert.equal(adminLoginResponse.status, 200);
  const adminCookie = adminLoginResponse.headers.get("set-cookie").split(";", 1)[0];

  const adminPageResponse = await fetch(`${baseUrl}/admin/`, { headers: { Cookie: adminCookie } });
  assert.equal(adminPageResponse.status, 200);
  assert.match(await adminPageResponse.text(), /Панель администратора/);

  const ordersResponse = await fetch(`${baseUrl}/api/admin/orders`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(ordersResponse.status, 200);
  const orders = (await ordersResponse.json()).orders;
  assert.equal(orders.length, 1);
  assert.equal(orders[0].id, createdOrder.id);
  assert.match(orders[0].items, /Start/);

  const statusResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ status: "processing" }),
  });
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).order.status, "processing");

  const promotionTitle = `Тестовая акция ${Date.now()}`;
  const promotionResponse = await fetch(`${baseUrl}/api/admin/promotions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      title: promotionTitle,
      description: "Тестовое описание новой акции для проверки административного API.",
      dateLabel: "Июл 1, 2026 - Июл 31, 2026",
      imageUrl: "assets/offer-crm.jpg",
    }),
  });
  assert.equal(promotionResponse.status, 201);
  const createdPromotion = (await promotionResponse.json()).promotion;

  const promotionsResponse = await fetch(`${baseUrl}/api/promotions`);
  assert.equal(promotionsResponse.status, 200);
  const promotions = (await promotionsResponse.json()).promotions;
  assert.ok(promotions.some((promotion) => promotion.title === promotionTitle));

  const deletePromotionResponse = await fetch(`${baseUrl}/api/admin/promotions/${createdPromotion.id}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert.equal(deletePromotionResponse.status, 200);
  assert.equal((await deletePromotionResponse.json()).promotion.active, false);

  const promotionsAfterDelete = await fetch(`${baseUrl}/api/promotions`);
  const activePromotions = (await promotionsAfterDelete.json()).promotions;
  assert.ok(!activePromotions.some((promotion) => promotion.id === createdPromotion.id));
});

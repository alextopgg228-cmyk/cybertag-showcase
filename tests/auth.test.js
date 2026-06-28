import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

test("registration, SQL session, logout and login", async (t) => {
  const port = 34000 + Math.floor(Math.random() * 1000);
  const databaseName = `CybertagShopTest_${process.pid}`;
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DB_NAME: databaseName,
      SEED_DEMO_USER: "0",
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
  assert.match(loginResponse.headers.get("set-cookie"), /^cybertag_session=/);
});

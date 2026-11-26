import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "./helpers/db.js";

process.env.AUTH_RATE_LIMIT = "3"; // active le limiteur de tentatives pour ce fichier uniquement

let h;
before(async () => {
  await resetDatabase();
  h = await import("./helpers/app.js");
});
after(async () => {
  await h.pool.end();
});

test("login : le 4e échec consécutif est bloqué, même avec le bon mot de passe", async () => {
  const user = await h.registerAndLogin(h.newClient());
  const client = h.newClient();

  for (let i = 0; i < 3; i += 1) {
    const res = await client.post("/login", { email: user.email, password: "mauvais" }, "/login");
    assert.equal(res.headers.location, "/login");
  }

  const blocked = await client.post(
    "/login",
    { email: user.email, password: user.password },
    "/login",
  );
  assert.equal(blocked.headers.location, "/login");
  assert.equal(
    (await client.get("/reviews")).status,
    302,
    "toujours déconnecté : le limiteur a bloqué la tentative",
  );
});

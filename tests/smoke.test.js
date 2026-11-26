import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "./helpers/db.js";

let h;
before(async () => {
  await resetDatabase();
  h = await import("./helpers/app.js");
});
after(async () => {
  await h.pool.end();
});

test("la page d'accueil et /health répondent", async () => {
  const home = await h.newClient().get("/");
  assert.equal(home.status, 200);
  const health = await h.newClient().get("/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
});

test("une route inconnue renvoie 404", async () => {
  const res = await h.newClient().get("/nope");
  assert.equal(res.status, 404);
});

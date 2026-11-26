// Parcourt toutes les pages rendues : détecte les erreurs de template (EJS) et de routage.
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

test("pages publiques", async () => {
  const anon = h.newClient();
  for (const url of [
    "/",
    "/about",
    "/contact",
    "/documentation",
    "/privacy",
    "/login",
    "/register",
    "/forgot-password",
    "/offline.html",
    "/manifest.webmanifest",
    "/sw.js",
  ]) {
    const res = await anon.get(url);
    assert.equal(res.status, 200, url);
  }
  const notFound = await anon.get("/page-inexistante");
  assert.equal(notFound.status, 404);
  assert.match(notFound.text, /404/);
  assert.match(
    (await anon.get("/reset-password/jeton-bidon-pas-valide")).headers.location,
    /forgot-password/,
  );
});

test("pages connectées : aucune ne casse (200) et les sections privées redirigent les anonymes", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client, {}, { verified: false });
  const gameId = await h.createGame({ title: "Jeu de page" });

  await client.post("/tags", { tagName: "Un tag" }, "/tags");
  const { rows: tags } = await h.pool.query("SELECT id_tag FROM tags WHERE user_id = $1", [
    user.id,
  ]);
  await client.post(
    "/reviews",
    {
      gameId,
      reviewTitle: "Review de page",
      reviewRate: "6",
      progressionStatus: "En cour",
      gamePlatforme: "PC",
      tagIds: tags[0].id_tag,
    },
    "/reviews/new",
  );
  const { rows: reviews } = await h.pool.query("SELECT id_review FROM reviews WHERE user_id = $1", [
    user.id,
  ]);
  await client.post("/lists", { title: "Liste de page" }, "/lists/new");

  const urls = [
    "/reviews",
    "/reviews/new",
    "/reviews/review-de-page",
    "/reviews/review-de-page/edit",
    `/tags`,
    `/tags/new`,
    `/tags/${tags[0].id_tag}`,
    `/tags/${tags[0].id_tag}/edit`,
    "/shares",
    "/shares/new/profile",
    `/shares/new/review?reviewId=${reviews[0].id_review}`,
    "/profile",
    "/profile/edit",
    "/lists",
    "/lists/new",
    "/lists/liste-de-page",
    "/lists/liste-de-page/edit",
    "/stats",
    "/import",
    "/feed",
  ];
  for (const url of urls) {
    const res = await client.get(url);
    assert.equal(res.status, 200, `${url} -> ${res.status}`);
  }

  // Le bandeau « email non confirmé » apparaît pour un compte non vérifié
  assert.match((await client.get("/reviews")).text, /pas encore confirmée/);

  const anon = h.newClient();
  for (const url of [
    "/reviews",
    "/tags",
    "/shares",
    "/profile",
    "/lists",
    "/stats",
    "/import",
    "/feed",
    "/admin",
    "/admin/events",
  ]) {
    const res = await anon.get(url);
    assert.equal(res.status, 302, url);
    assert.equal(res.headers.location, "/login", url);
  }
});

test("en-têtes de sécurité et CSP sans handlers inline", async () => {
  const res = await h.newClient().get("/login");
  assert.match(res.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(res.headers["content-security-policy"], /script-src-attr 'none'/);
  assert.equal(res.headers["x-powered-by"], undefined);
  assert.ok(res.headers["x-request-id"]);
});

test("aucune vue ne contient de handler inline (onclick, onsubmit...)", async () => {
  const { execSync } = await import("node:child_process");
  const out = execSync(
    `grep -rEn ' on(click|submit|change|load|error)=' src/views || true`,
  ).toString();
  assert.equal(out.trim(), "");
});

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { resetDatabase } from "./helpers/db.js";

let h;
before(async () => {
  await resetDatabase();
  h = await import("./helpers/app.js");
});
after(async () => {
  await h.pool.end();
});

const reviewBody = (gameId, title) => ({
  gameId,
  reviewTitle: title,
  reviewRate: "9",
  progressionStatus: "Terminé",
  gamePlatforme: "PC",
});

async function seedReviewShare(client, user, { maxViews = "", expiration = "" } = {}) {
  const gameId = await h.createGame();
  await client.post("/reviews", reviewBody(gameId, `Review ${user.pseudo}`), "/reviews/new");
  const { rows } = await h.pool.query("SELECT id_review FROM reviews WHERE user_id = $1", [
    user.id,
  ]);
  h.MailService.outbox.length = 0;
  await client.post(
    "/shares/review",
    { reviewId: rows[0].id_review, recipientEmail: "ami@example.test", maxViews, expiration },
    "/shares/new/review?reviewId=" + rows[0].id_review,
  );
  const mail = h.MailService.outbox.at(-1);
  const token = /shares\/access\/([\w-]+)/.exec(mail?.text || "")?.[1];
  return { reviewId: rows[0].id_review, token };
}

test("un compte non vérifié ne peut pas créer de partage", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client, {}, { verified: false });
  const { token } = await seedReviewShare(client, user);
  assert.equal(token, undefined);
  const { rowCount } = await h.pool.query("SELECT 1 FROM shares WHERE user_id = $1", [user.id]);
  assert.equal(rowCount, 0);
});

test("partage : seul le propriétaire peut révoquer ou partager sa review", async () => {
  const a = h.newClient();
  const userA = await h.registerAndLogin(a);
  const { reviewId, token } = await seedReviewShare(a, userA);
  assert.ok(token, "le lien d'accès est envoyé par email");

  const { rows: shares } = await h.pool.query("SELECT id_share FROM shares WHERE user_id = $1", [
    userA.id,
  ]);
  assert.equal(shares.length, 1);

  const b = h.newClient();
  await h.registerAndLogin(b);

  // B ne peut pas révoquer le partage de A
  const del = await b.post(`/shares/${shares[0].id_share}/delete`, {}, "/shares");
  assert.equal(del.status, 404);
  assert.equal(
    (await h.pool.query("SELECT 1 FROM shares WHERE id_share = $1", [shares[0].id_share])).rowCount,
    1,
  );

  // B ne peut pas partager la review de A
  const steal = await b.post(
    "/shares/review",
    { reviewId, recipientEmail: "pirate@example.test" },
    "/shares",
  );
  assert.equal(steal.status, 403);
  assert.equal(
    (await h.pool.query("SELECT 1 FROM shares WHERE recipient_email = 'pirate@example.test'"))
      .rowCount,
    0,
  );

  // A peut révoquer
  const ok = await a.post(`/shares/${shares[0].id_share}/delete`, {}, "/shares");
  assert.equal(ok.headers.location, "/shares");
  assert.equal(
    (await h.pool.query("SELECT 1 FROM shares WHERE id_share = $1", [shares[0].id_share])).rowCount,
    0,
  );
});

test("accès public : contenu servi sans authentification, en-têtes de confidentialité, compteur de vues", async () => {
  const a = h.newClient();
  const user = await h.registerAndLogin(a);
  const { token } = await seedReviewShare(a, user);

  const anon = h.newClient();
  const res = await anon.get(`/shares/access/${token}`);
  assert.equal(res.status, 200);
  assert.match(res.text, new RegExp(user.pseudo));
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.headers["referrer-policy"], "no-referrer");
  assert.match(res.headers["x-robots-tag"], /noindex/);
  assert.match(res.text, /og:title/);

  const { rows } = await h.pool.query("SELECT access_config FROM shares WHERE share_token = $1", [
    token,
  ]);
  assert.equal(rows[0].access_config.view_count, 1);
});

test("accès public : limite de vues, expiration et jeton invalide", async () => {
  const a = h.newClient();
  const user = await h.registerAndLogin(a);
  const { token } = await seedReviewShare(a, user, { maxViews: "2" });
  const anon = h.newClient();

  assert.equal((await anon.get(`/shares/access/${token}`)).status, 200);
  assert.equal((await anon.get(`/shares/access/${token}`)).status, 200);
  assert.equal((await anon.get(`/shares/access/${token}`)).status, 404, "limite atteinte");

  // Concurrence : 10 accès simultanés pour une limite de 3 => exactement 3 réussites
  const b = h.newClient();
  const userB = await h.registerAndLogin(b);
  const { token: token2 } = await seedReviewShare(b, userB, { maxViews: "3" });
  const results = await Promise.all(
    Array.from({ length: 10 }, () => h.newClient().get(`/shares/access/${token2}`)),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 3);

  // Expiration
  const c = h.newClient();
  const userC = await h.registerAndLogin(c);
  const { token: token3 } = await seedReviewShare(c, userC);
  await h.pool.query(
    "UPDATE shares SET access_config = jsonb_set(access_config, '{expiration}', to_jsonb($1::text)) WHERE share_token = $2",
    [new Date(Date.now() - 1000).toISOString(), token3],
  );
  assert.equal((await anon.get(`/shares/access/${token3}`)).status, 404);

  assert.equal((await anon.get("/shares/access/jeton-invalide-et-trop-court")).status, 404);
  assert.equal((await anon.get(`/shares/access/${"x".repeat(43)}`)).status, 404);
});

test("une expiration passée ou une limite invalide est refusée à la création", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  const { token } = await seedReviewShare(client, user, { expiration: "2000-01-01" });
  assert.equal(token, undefined);
  assert.equal(
    (await h.pool.query("SELECT 1 FROM shares WHERE user_id = $1", [user.id])).rowCount,
    0,
  );
});

async function png() {
  return sharp({ create: { width: 600, height: 300, channels: 3, background: "#7c3aed" } })
    .png()
    .toBuffer();
}

test("profil : avatar ré-encodé en WebP, ancien avatar supprimé, faux fichier refusé", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  const token = await client.csrf("/profile/edit");

  const send = (buffer, filename, mime) =>
    client.agent
      .post("/profile/edit")
      .field("_csrf", token)
      .field("pseudo", user.pseudo)
      .field("biographie", "Bio de test")
      .attach("avatar", buffer, { filename, contentType: mime });

  const res = await send(await png(), "a.png", "image/png");
  assert.equal(res.headers.location, "/profile");
  let { rows } = await h.pool.query("SELECT avatar, biographie FROM users WHERE id_user = $1", [
    user.id,
  ]);
  const first = rows[0].avatar;
  assert.match(first, /^\/uploads\/avatars\/\d+-\d+\.webp$/);
  assert.equal(rows[0].biographie, "Bio de test");
  const firstFile = path.join(process.cwd(), "public", first);
  assert.ok(fs.existsSync(firstFile));

  // Fichier texte déguisé en image : refusé, avatar inchangé
  const fake = await send(Buffer.from("<script>alert(1)</script>"), "x.png", "image/png");
  assert.equal(fake.headers.location, "/profile/edit");
  // SVG déguisé en PNG : format non autorisé
  const svg = await send(
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    "x.png",
    "image/png",
  );
  assert.equal(svg.headers.location, "/profile/edit");
  ({ rows } = await h.pool.query("SELECT avatar FROM users WHERE id_user = $1", [user.id]));
  assert.equal(rows[0].avatar, first);

  // Nouvel avatar : l'ancien fichier disparaît
  await send(await png(), "b.png", "image/png");
  ({ rows } = await h.pool.query("SELECT avatar FROM users WHERE id_user = $1", [user.id]));
  assert.notEqual(rows[0].avatar, first);
  assert.ok(!fs.existsSync(firstFile), "l'ancien avatar est supprimé du disque");

  // CSRF obligatoire aussi sur l'upload multipart
  const noCsrf = await client.agent.post("/profile/edit").field("pseudo", user.pseudo);
  assert.equal(noCsrf.status, 403);

  // Suppression du compte : données et fichier avatar supprimés
  const current = path.join(process.cwd(), "public", rows[0].avatar);
  assert.ok(fs.existsSync(current));
  const del = await client.post("/profile/delete", {}, "/profile");
  assert.equal(del.headers.location, "/register");
  assert.ok(!fs.existsSync(current), "avatar supprimé avec le compte");
  assert.equal(
    (await h.pool.query("SELECT 1 FROM users WHERE id_user = $1", [user.id])).rowCount,
    0,
  );
  assert.equal((await client.get("/profile")).status, 302);
});

test("export RGPD : JSON complet sans jeton de partage ni hash de mot de passe", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  await seedReviewShare(client, user);

  const res = await client.get("/profile/export");
  assert.equal(res.status, 200);
  assert.match(res.headers["content-disposition"], /attachment/);
  const data = JSON.parse(res.text);
  assert.equal(data.user.email, user.email);
  assert.equal(data.reviews.length, 1);
  assert.equal(data.shares.length, 1);
  assert.ok(!/argon2|shareToken|share_token/i.test(res.text));
});

async function makeAdmin(client) {
  const admin = h.uniqueUser("admin");
  await h.registerAndLogin(h.newClient(), admin);
  await h.pool.query("UPDATE users SET role_name = 'admin' WHERE email = $1", [admin.email]);
  await client.post("/login", { email: admin.email, password: admin.password }, "/login");
  const { rows } = await h.pool.query("SELECT id_user FROM users WHERE email = $1", [admin.email]);
  return { ...admin, id: rows[0].id_user };
}

test("espace admin : réservé aux admins, protégé par CSRF, garde-fous de suppression", async () => {
  const regular = h.newClient();
  const normal = await h.registerAndLogin(regular);
  assert.equal((await regular.get("/admin")).headers.location, "/reviews");
  assert.equal((await regular.get("/admin/events/stats")).headers.location, "/reviews");

  const adminClient = h.newClient();
  const admin = await makeAdmin(adminClient);
  assert.equal((await adminClient.get("/admin")).status, 200);
  for (const page of ["users", "reviews", "tags", "shares", "games"]) {
    assert.equal((await adminClient.get(`/admin/${page}`)).status, 200, `/admin/${page}`);
  }

  // Sans jeton CSRF : refusé
  const noToken = await adminClient.agent
    .post(`/admin/users/${normal.id}/delete`)
    .type("form")
    .send({});
  assert.equal(noToken.status, 403);
  assert.equal(
    (await h.pool.query("SELECT 1 FROM users WHERE id_user = $1", [normal.id])).rowCount,
    1,
  );

  // Ne peut pas se supprimer lui-même, ni le dernier admin
  await adminClient.post(`/admin/users/${admin.id}/delete`, {}, "/admin/users");
  assert.equal(
    (await h.pool.query("SELECT 1 FROM users WHERE id_user = $1", [admin.id])).rowCount,
    1,
  );

  // Suppression d'un utilisateur standard : OK + audit
  await adminClient.post(`/admin/users/${normal.id}/delete`, {}, "/admin/users");
  assert.equal(
    (await h.pool.query("SELECT 1 FROM users WHERE id_user = $1", [normal.id])).rowCount,
    0,
  );
  const { rows } = await h.pool.query(
    "SELECT 1 FROM app_events WHERE event_type = 'admin.users_deleted'",
  );
  assert.equal(rows.length, 1);

  // API événements (JSON)
  const stats = await adminClient.get("/admin/events/stats");
  assert.equal(stats.status, 200);
  assert.ok(stats.body.totalEvents > 0);
  const list = await adminClient.get("/admin/events?limit=5");
  assert.equal(list.body.events.length, 5);
  const missing = await adminClient.get("/admin/events/00000000-0000-0000-0000-000000000000");
  assert.equal(missing.status, 404);
  assert.equal(typeof missing.body.error, "string");
  const bad = await adminClient.get("/admin/events/pas-un-uuid");
  assert.equal(bad.status, 404);
});

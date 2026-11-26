import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import { resetDatabase } from "./helpers/db.js";

let h;
before(async () => {
  await resetDatabase();
  h = await import("./helpers/app.js");
});
after(async () => {
  await h.pool.end();
});

const cookieValue = (res, name) => {
  const header = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return header ? header.split(";")[0] : null;
};

test("un POST sans jeton CSRF est refusé (403)", async () => {
  const res = await supertest(h.app)
    .post("/login")
    .type("form")
    .send({ email: "a@b.co", password: "x" });
  assert.equal(res.status, 403);
});

test("un POST avec un jeton CSRF d'une autre session est refusé", async () => {
  const a = h.newClient();
  const tokenA = await a.csrf("/login");
  const b = h.newClient();
  await b.get("/login");
  const res = await b.agent
    .post("/login")
    .type("form")
    .send({ email: "a@b.co", password: "x", _csrf: tokenA });
  assert.equal(res.status, 403);
});

test("l'inscription enregistre le consentement RGPD et envoie un email de confirmation", async () => {
  const client = h.newClient();
  const user = h.uniqueUser();
  h.MailService.outbox.length = 0;

  const res = await client.post("/register", { ...user, gdprConsent: "on" }, "/register");
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/login");

  const { rows } = await h.pool.query(
    "SELECT gdpr_consent, gdpr_consent_date, email_verified_at, password_hash FROM users WHERE email = $1",
    [user.email],
  );
  assert.equal(rows[0].gdpr_consent, true);
  assert.ok(rows[0].gdpr_consent_date);
  assert.equal(rows[0].email_verified_at, null);
  assert.ok(rows[0].password_hash.startsWith("$argon2id$"));

  assert.equal(h.MailService.outbox.length, 1);
  assert.match(h.MailService.outbox[0].text, /\/verify-email\//);
});

test("l'inscription sans consentement RGPD est refusée", async () => {
  const client = h.newClient();
  const user = h.uniqueUser();
  const res = await client.post("/register", user, "/register");
  assert.equal(res.status, 302);
  const { rowCount } = await h.pool.query("SELECT 1 FROM users WHERE email = $1", [user.email]);
  assert.equal(rowCount, 0);
});

test("un mot de passe n'est jamais conservé dans la session après une erreur de validation", async () => {
  const client = h.newClient();
  const secret = "MotDePasse-Secret-Unique-42";
  await client.post(
    "/register",
    { pseudo: "x", email: "pas-un-email", password: secret, gdprConsent: "on" },
    "/register",
  );
  const { rows } = await h.pool.query("SELECT sess FROM user_sessions");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => !JSON.stringify(r.sess).includes(secret)));
});

test("connexion : mauvais mot de passe refusé, bon mot de passe accepté, session régénérée", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(h.newClient()); // crée le compte
  const bad = await client.post(
    "/login",
    { email: user.email, password: "mauvais-mot-de-passe" },
    "/login",
  );
  assert.equal(bad.headers.location, "/login");
  assert.equal((await client.get("/reviews")).status, 302); // toujours déconnecté

  const before = cookieValue(await client.get("/login"), "gamingbox.sid");
  const ok = await client.post("/login", { email: user.email, password: user.password }, "/login");
  assert.equal(ok.headers.location, "/reviews");
  const after = cookieValue(ok, "gamingbox.sid");

  assert.ok(after, "un nouveau cookie de session est émis");
  if (before) assert.notEqual(before, after, "l'identifiant de session change à la connexion");
  assert.equal((await client.get("/reviews")).status, 200);
});

test("déconnexion : session détruite et cookie effacé", async () => {
  const client = h.newClient();
  await h.registerAndLogin(client);
  const res = await client.post("/logout", {}, "/reviews");
  assert.equal(res.headers.location, "/login");
  assert.match(res.headers["set-cookie"].join(";"), /gamingbox\.sid=;/);
  assert.equal((await client.get("/reviews")).status, 302);
});

test("vérification d'email : le lien confirme l'adresse, une seule fois", async () => {
  const client = h.newClient();
  h.MailService.outbox.length = 0;
  const user = await h.registerAndLogin(client, {}, { verified: false });
  const mail = h.MailService.outbox.find((m) => m.to === user.email);
  const token = /verify-email\/([\w-]+)/.exec(mail.text)[1];

  const first = await client.get(`/verify-email/${token}`);
  assert.equal(first.status, 302);
  const { rows } = await h.pool.query("SELECT email_verified_at FROM users WHERE email = $1", [
    user.email,
  ]);
  assert.ok(rows[0].email_verified_at);

  await client.get(`/verify-email/${token}`);
  const { rows: tokens } = await h.pool.query(
    "SELECT used_at FROM auth_tokens WHERE user_id = $1",
    [user.id],
  );
  assert.ok(tokens.every((t) => t.used_at));
});

test("mot de passe oublié : réponse identique pour un email inconnu, reset à usage unique, sessions coupées", async () => {
  const owner = h.newClient();
  const user = await h.registerAndLogin(owner);
  assert.equal((await owner.get("/reviews")).status, 200);

  const anon = h.newClient();
  h.MailService.outbox.length = 0;

  const unknown = await anon.post(
    "/forgot-password",
    { email: "inconnu@example.test" },
    "/forgot-password",
  );
  const known = await anon.post("/forgot-password", { email: user.email }, "/forgot-password");
  assert.equal(unknown.headers.location, known.headers.location);
  assert.equal(h.MailService.outbox.length, 1);

  const token = /reset-password\/([\w-]+)/.exec(h.MailService.outbox[0].text)[1];
  const newPassword = "Nouveau-Mot-De-Passe-77";

  const mismatch = await anon.post(
    `/reset-password/${token}`,
    { password: newPassword, passwordConfirm: "autre" },
    `/reset-password/${token}`,
  );
  assert.equal(mismatch.status, 302);

  const done = await anon.post(
    `/reset-password/${token}`,
    { password: newPassword, passwordConfirm: newPassword },
    `/reset-password/${token}`,
  );
  assert.equal(done.headers.location, "/login");

  const again = await h
    .newClient()
    .post(
      `/reset-password/${token}`,
      { password: "Encore-Un-Autre-88", passwordConfirm: "Encore-Un-Autre-88" },
      "/login",
    );
  assert.equal(again.status, 302);
  const login = await h
    .newClient()
    .post("/login", { email: user.email, password: "Encore-Un-Autre-88" }, "/login");
  assert.equal(login.headers.location, "/login", "le jeton ne sert qu'une fois");

  assert.equal((await owner.get("/reviews")).status, 302, "l'ancienne session est révoquée");
  const ok = await h
    .newClient()
    .post("/login", { email: user.email, password: newPassword }, "/login");
  assert.equal(ok.headers.location, "/reviews");
});

test("les mots de passe et hash ne sont jamais écrits dans les logs d'événements", async () => {
  const { rows } = await h.pool.query("SELECT metadata::text AS m FROM app_events");
  assert.ok(rows.every((r) => !/argon2|password/i.test(r.m)));
});

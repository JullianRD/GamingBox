import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "./helpers/db.js";
import { parseCsv, csvCell } from "../src/utils/csv.js";

let h;
before(async () => {
  await resetDatabase();
  h = await import("./helpers/app.js");
});
after(async () => {
  await h.pool.end();
});

const body = (gameId, title, over = {}) => ({
  gameId,
  reviewTitle: title,
  reviewRate: "8",
  progressionStatus: "Terminé",
  gamePlatforme: "PC",
  avisReview: "Super jeu.",
  ...over,
});

test("csv : guillemets, séparateur ; et retours à la ligne", () => {
  const rows = parseCsv('titre;note\n"Zelda; BotW";9\n"Ligne\nmultiple ""cité""";7\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].titre, "Zelda; BotW");
  assert.equal(rows[1].titre, 'Ligne\nmultiple "cité"');
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell('a"b'), '"a""b"');
});

test("statistiques : agrégats corrects et filtre par année", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  await client.post(
    "/reviews",
    body(await h.createGame({ genre: "RPG" }), "Jeu un", { reviewRate: "9", reviewPlatine: "on" }),
    "/reviews/new",
  );
  await client.post(
    "/reviews",
    body(await h.createGame({ genre: "RPG" }), "Jeu deux", {
      reviewRate: "7",
      progressionStatus: "Dropped",
    }),
    "/reviews/new",
  );
  await h.pool.query(
    "UPDATE reviews SET created_at = '2024-03-10' WHERE review_title = 'Jeu deux' AND user_id = $1",
    [user.id],
  );

  const all = await client.get("/stats?year=all");
  assert.equal(all.status, 200);
  assert.match(all.text, />2<\/dd>/);
  assert.match(all.text, /8(\.00)?\/10/);

  const y2024 = await client.get("/stats?year=2024");
  assert.equal(y2024.status, 200);
  assert.match(y2024.text, /Année 2024/);
  assert.equal((await client.get("/stats?year=abc")).status, 200);
});

test("import CSV : jeux retrouvés, doublons ignorés, lignes invalides signalées", async () => {
  const { default: ImportService } = await import("../src/services/ImportService.js");
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  await h.createGame({ title: "Hollow Knight" });
  await h.createGame({ title: "Celeste" });

  const csv = [
    "titre,statut,note,plateforme",
    "Hollow Knight,Terminé,9.5,PC",
    "celeste,en cours,8,Switch",
    "Hollow Knight,Terminé,9,PC",
    ",Terminé,5,PC",
    "Jeu inconnu,Terminé,5,PC",
  ].join("\n");

  const report = await ImportService.importCsv(user.id, csv, { searchIgdb: async () => [] });
  assert.equal(report.created, 2);
  assert.equal(report.skipped.length, 1);
  assert.equal(report.failed.length, 2);

  const { rows } = await h.pool.query(
    "SELECT review_title, progression_status, game_platforme, review_rate FROM reviews WHERE user_id = $1",
    [user.id],
  );
  assert.deepEqual(
    rows
      .map((r) => [r.review_title, r.progression_status, r.game_platforme, Number(r.review_rate)])
      .sort((a, b) => a[0].localeCompare(b[0], "fr", { sensitivity: "base" })),
    [
      ["celeste", "En cour", "Console de jeu", 8],
      ["Hollow Knight", "Terminé", "PC", 9.5],
    ],
  );

  const tooMany = "titre\n" + Array.from({ length: 201 }, (_, i) => `Jeu ${i}`).join("\n");
  await assert.rejects(() => ImportService.importCsv(user.id, tooMany), /200 lignes/);
});

test("import CSV via HTTP : upload multipart protégé par CSRF", async () => {
  const client = h.newClient();
  await h.registerAndLogin(client);
  const token = await client.csrf("/import");

  const noCsrf = await client.agent
    .post("/import")
    .attach("file", Buffer.from("titre\nX"), "a.csv");
  assert.equal(noCsrf.status, 403);

  const ok = await client.agent
    .post("/import")
    .field("_csrf", token)
    .attach("file", Buffer.from("titre\nJeu introuvable zzz"), {
      filename: "a.csv",
      contentType: "text/csv",
    });
  assert.equal(ok.status, 200);
  assert.match(ok.text, /Jeu introuvable|IGDB|indisponible|en échec/);
});

test("listes : CRUD, ajout limité aux jeux de la bibliothèque, isolation entre utilisateurs", async () => {
  const a = h.newClient();
  const userA = await h.registerAndLogin(a);
  const gameId = await h.createGame({ title: "Chrono Trigger" });
  const otherGame = await h.createGame({ title: "Pas dans ma biblio" });
  await a.post("/reviews", body(gameId, "Chrono Trigger review"), "/reviews/new");

  await a.post(
    "/lists",
    { title: "Mes meilleurs RPG", description: "Top", isPublic: "on" },
    "/lists/new",
  );
  const show = await a.get("/lists/mes-meilleurs-rpg");
  assert.equal(show.status, 200);

  await a.post(
    "/lists/mes-meilleurs-rpg/items",
    { gameId, note: "Culte" },
    "/lists/mes-meilleurs-rpg",
  );
  await a.post("/lists/mes-meilleurs-rpg/items", { gameId: otherGame }, "/lists/mes-meilleurs-rpg");
  const { rows: items } = await h.pool.query("SELECT game_id FROM game_list_items");
  assert.equal(items.length, 1);

  // doublon de titre
  await a.post("/lists", { title: "Mes meilleurs RPG" }, "/lists/new");
  assert.equal(
    (await h.pool.query("SELECT 1 FROM game_lists WHERE user_id = $1", [userA.id])).rowCount,
    1,
  );

  const b = h.newClient();
  await h.registerAndLogin(b);
  assert.equal((await b.get("/lists/mes-meilleurs-rpg")).status, 404);
  assert.equal((await b.post("/lists/mes-meilleurs-rpg/delete", {}, "/lists")).status, 404);
  assert.equal((await h.pool.query("SELECT 1 FROM game_lists")).rowCount, 1);

  await a.post(`/lists/mes-meilleurs-rpg/items/${gameId}/delete`, {}, "/lists/mes-meilleurs-rpg");
  assert.equal((await h.pool.query("SELECT 1 FROM game_list_items")).rowCount, 0);
});

test("profil public : 404 tant que privé, pages et listes publiques ensuite, reviews privées jamais exposées", async () => {
  const author = h.newClient();
  const userA = await h.registerAndLogin(author);
  const g1 = await h.createGame({ title: "Public Game" });
  const g2 = await h.createGame({ title: "Private Game" });
  await author.post("/reviews", body(g1, "Review publique", { isPublic: "on" }), "/reviews/new");
  await author.post("/reviews", body(g2, "Review secrete"), "/reviews/new");
  await author.post("/lists", { title: "Liste ouverte", isPublic: "on" }, "/lists/new");

  const anon = h.newClient();
  assert.equal((await anon.get(`/u/${userA.pseudo}`)).status, 404, "profil privé");
  assert.equal((await anon.get(`/u/${userA.pseudo}/reviews/review-publique`)).status, 404);

  // Rendre le profil public via le formulaire d'édition
  await author.post("/profile/edit", {}, "/profile/edit").catch(() => {});
  await h.pool.query("UPDATE users SET profile_public = true WHERE id_user = $1", [userA.id]);

  const profile = await anon.get(`/u/${userA.pseudo}`);
  assert.equal(profile.status, 200);
  assert.match(profile.text, /Review publique/);
  assert.doesNotMatch(profile.text, /Review secrete/);
  assert.equal((await anon.get(`/u/${userA.pseudo}/reviews/review-secrete`)).status, 404);
  assert.equal((await anon.get(`/u/${userA.pseudo}/reviews/review-publique`)).status, 200);
  assert.equal((await anon.get(`/u/${userA.pseudo}/lists/liste-ouverte`)).status, 200);
  assert.equal((await anon.get("/u/inconnu-total")).status, 404);
});

test("abonnements, fil d'actualité et likes", async () => {
  const author = h.newClient();
  const userA = await h.registerAndLogin(author);
  await author.post(
    "/reviews",
    body(await h.createGame({ title: "Jeu du fil" }), "Review du fil", { isPublic: "on" }),
    "/reviews/new",
  );
  await h.pool.query("UPDATE users SET profile_public = true WHERE id_user = $1", [userA.id]);

  const fan = h.newClient();
  const userB = await h.registerAndLogin(fan);

  assert.match((await fan.get("/feed")).text, /Rien pour le moment/);

  await fan.post(`/u/${userA.pseudo}/follow`, {}, `/u/${userA.pseudo}`);
  assert.equal(
    (await h.pool.query("SELECT 1 FROM user_follows WHERE follower_id = $1", [userB.id])).rowCount,
    1,
  );
  assert.match((await fan.get("/feed")).text, /Review du fil/);

  // On ne peut pas se suivre soi-même ; suivre deux fois reste idempotent
  await author.post(`/u/${userA.pseudo}/follow`, {}, `/u/${userA.pseudo}`);
  await fan.post(`/u/${userA.pseudo}/follow`, {}, `/u/${userA.pseudo}`);
  assert.equal((await h.pool.query("SELECT 1 FROM user_follows")).rowCount, 1);

  await fan.post(
    `/u/${userA.pseudo}/reviews/review-du-fil/like`,
    {},
    `/u/${userA.pseudo}/reviews/review-du-fil`,
  );
  assert.equal((await h.pool.query("SELECT 1 FROM review_likes")).rowCount, 1);
  await fan.post(
    `/u/${userA.pseudo}/reviews/review-du-fil/like`,
    {},
    `/u/${userA.pseudo}/reviews/review-du-fil`,
  );
  assert.equal((await h.pool.query("SELECT 1 FROM review_likes")).rowCount, 0);

  // Sans connexion : redirection ; sans CSRF : 403
  const anon = h.newClient();
  assert.equal((await anon.get("/feed")).status, 302);
  const noCsrf = await fan.agent.post(`/u/${userA.pseudo}/unfollow`).type("form").send({});
  assert.equal(noCsrf.status, 403);

  await fan.post(`/u/${userA.pseudo}/unfollow`, {}, `/u/${userA.pseudo}`);
  assert.equal((await h.pool.query("SELECT 1 FROM user_follows")).rowCount, 0);

  // Retour au privé : les reviews disparaissent du fil
  await fan.post(`/u/${userA.pseudo}/follow`, {}, `/u/${userA.pseudo}`);
  await h.pool.query("UPDATE users SET profile_public = false WHERE id_user = $1", [userA.id]);
  assert.match((await fan.get("/feed")).text, /Rien pour le moment/);
});

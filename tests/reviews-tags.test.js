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

const reviewBody = (gameId, over = {}) => ({
  gameId,
  reviewTitle: "Un super jeu d'aventure",
  reviewRate: "8.5",
  progressionStatus: "Terminé",
  gamePlatforme: "PC",
  avisReview: "Très bon.",
  ...over,
});

async function createTag(client, tagName) {
  await client.post("/tags", { tagName }, "/tags");
  const { rows } = await h.pool.query("SELECT id_tag FROM tags WHERE tag_name = $1 ORDER BY created_at DESC LIMIT 1", [tagName]);
  return rows[0].id_tag;
}

test("création d'une review : slug sans accents, tags rattachés, review privée par défaut", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  const gameId = await h.createGame();
  const tagId = await createTag(client, "RPG culte");

  const res = await client.post(
    "/reviews",
    reviewBody(gameId, { reviewTitle: "Pokémon : Édition Rouge !", tagIds: tagId, reviewLike: "on" }),
    "/reviews/new",
  );
  assert.equal(res.headers.location, "/reviews");

  const { rows } = await h.pool.query("SELECT slug, review_like, is_public FROM reviews WHERE user_id = $1", [user.id]);
  assert.equal(rows[0].slug, "pokemon-edition-rouge");
  assert.equal(rows[0].review_like, true);
  assert.equal(rows[0].is_public, false);

  const { rowCount } = await h.pool.query(
    "SELECT 1 FROM review_tags rt JOIN reviews r USING (id_review) WHERE r.user_id = $1 AND rt.id_tag = $2",
    [user.id, tagId],
  );
  assert.equal(rowCount, 1);

  const show = await client.get("/reviews/pokemon-edition-rouge");
  assert.equal(show.status, 200);
});

test("la review d'un autre utilisateur est introuvable (lecture, édition, suppression)", async () => {
  const owner = h.newClient();
  await h.registerAndLogin(owner);
  const gameId = await h.createGame();
  await owner.post("/reviews", reviewBody(gameId, { reviewTitle: "Review privée de A" }), "/reviews/new");

  const intruder = h.newClient();
  await h.registerAndLogin(intruder);
  assert.equal((await intruder.get("/reviews/review-privee-de-a")).status, 404);
  assert.equal((await intruder.get("/reviews/review-privee-de-a/edit")).status, 404);
  const del = await intruder.post("/reviews/review-privee-de-a/delete", {}, "/reviews");
  assert.equal(del.status, 404);

  const { rowCount } = await h.pool.query("SELECT 1 FROM reviews WHERE slug = 'review-privee-de-a'");
  assert.equal(rowCount, 1);
});

test("on ne peut pas rattacher le tag d'un autre utilisateur à sa review", async () => {
  const a = h.newClient();
  await h.registerAndLogin(a);
  const foreignTag = await createTag(a, "Tag de A");

  const b = h.newClient();
  const userB = await h.registerAndLogin(b);
  const gameId = await h.createGame();
  await b.post("/reviews", reviewBody(gameId, { reviewTitle: "Review de B", tagIds: foreignTag }), "/reviews/new");

  const { rowCount } = await h.pool.query(
    "SELECT 1 FROM review_tags rt JOIN reviews r USING (id_review) WHERE r.user_id = $1",
    [userB.id],
  );
  assert.equal(rowCount, 0);
});

test("on peut retirer tous les tags d'une review en édition (tagIds vide)", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  const gameId = await h.createGame();
  const tagId = await createTag(client, "A retirer");
  await client.post("/reviews", reviewBody(gameId, { reviewTitle: "Review avec tag", tagIds: tagId }), "/reviews/new");

  const res = await client.post(
    "/reviews/review-avec-tag",
    { reviewTitle: "Review avec tag", reviewRate: "7", progressionStatus: "En cour", gamePlatforme: "PC", tagIds: "" },
    "/reviews/review-avec-tag/edit",
  );
  assert.equal(res.headers.location, "/reviews");

  const { rowCount } = await h.pool.query(
    "SELECT 1 FROM review_tags rt JOIN reviews r USING (id_review) WHERE r.user_id = $1",
    [user.id],
  );
  assert.equal(rowCount, 0);
});

test("décocher « J'aime » en édition met bien review_like à false", async () => {
  const client = h.newClient();
  const user = await h.registerAndLogin(client);
  const gameId = await h.createGame();
  await client.post("/reviews", reviewBody(gameId, { reviewTitle: "Review likée", reviewLike: "on" }), "/reviews/new");

  await client.post(
    "/reviews/review-likee",
    { reviewTitle: "Review likée", reviewRate: "7", progressionStatus: "En cour", gamePlatforme: "PC" },
    "/reviews/review-likee/edit",
  );
  const { rows } = await h.pool.query("SELECT review_like FROM reviews WHERE user_id = $1", [user.id]);
  assert.equal(rows[0].review_like, false);
});

test("renommer un tag fonctionne ; le tag d'un autre est intouchable ; doublon refusé", async () => {
  const a = h.newClient();
  await h.registerAndLogin(a);
  const tagA = await createTag(a, "Ancien nom");
  await createTag(a, "Existant");

  await a.post(`/tags/${tagA}`, { tagName: "Nouveau nom" }, `/tags/${tagA}/edit`);
  let { rows } = await h.pool.query("SELECT tag_name FROM tags WHERE id_tag = $1", [tagA]);
  assert.equal(rows[0].tag_name, "Nouveau nom");

  await a.post(`/tags/${tagA}`, { tagName: "existant" }, `/tags/${tagA}/edit`);
  ({ rows } = await h.pool.query("SELECT tag_name FROM tags WHERE id_tag = $1", [tagA]));
  assert.equal(rows[0].tag_name, "Nouveau nom");

  const b = h.newClient();
  await h.registerAndLogin(b);
  assert.equal((await b.post(`/tags/${tagA}`, { tagName: "Piraté" }, "/tags")).status, 404);
  assert.equal((await b.post(`/tags/${tagA}/delete`, {}, "/tags")).status, 404);
  ({ rows } = await h.pool.query("SELECT tag_name FROM tags WHERE id_tag = $1", [tagA]));
  assert.equal(rows[0].tag_name, "Nouveau nom");
});

test("redirectTo externe est ignoré (pas de redirection ouverte)", async () => {
  const client = h.newClient();
  await h.registerAndLogin(client);
  const res = await client.post("/tags", { tagName: "Safe", redirectTo: "https://evil.example/phish" }, "/tags");
  assert.equal(res.headers.location, "/reviews");
  const res2 = await client.post("/tags", { tagName: "Safe2", redirectTo: "//evil.example" }, "/tags");
  assert.equal(res2.headers.location, "/reviews");
});

test("liste : recherche, filtre de statut, tri et pagination", async () => {
  const client = h.newClient();
  await h.registerAndLogin(client);
  for (let i = 1; i <= 14; i += 1) {
    const gameId = await h.createGame({ title: `Aventure ${i}` });
    await client.post(
      "/reviews",
      reviewBody(gameId, {
        reviewTitle: `Review numero ${i}`,
        reviewRate: String(i % 10),
        progressionStatus: i % 2 ? "Terminé" : "Dropped",
      }),
      "/reviews/new",
    );
  }

  const page1 = await client.get("/reviews");
  assert.equal(page1.status, 200);
  assert.match(page1.text, /14 reviews/);
  assert.match(page1.text, /Page 1 \/ 2/);
  assert.equal((await client.get("/reviews?page=2")).status, 200);

  const search = await client.get("/reviews?q=numero%2013");
  assert.match(search.text, /1 review/);
  assert.match(search.text, /Review numero 13/);

  // % et _ sont littéraux : aucun résultat pour « % »
  const like = await client.get("/reviews?q=%25");
  assert.match(like.text, /0 review/);

  const dropped = await client.get("/reviews?status=Dropped");
  assert.match(dropped.text, /7 reviews/);

  // paramètres invalides ignorés, pas d'erreur 500
  assert.equal((await client.get("/reviews?page=abc&status=zzz&tag=nope&sort=drop")).status, 200);
});

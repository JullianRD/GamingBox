// Tests d'intégration : nécessitent une base PostgreSQL 18 vide dédiée aux tests.
// Lancement : TEST_DATABASE_URL=postgresql://... npm test
// Sans TEST_DATABASE_URL, ces tests sont ignorés.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let TagRepository;
let userId;

const migrate = (direction) =>
  runner({
    databaseUrl,
    dir: "migrations",
    direction,
    count: direction === "up" ? Infinity : 0,
    migrationsTable: "pgmigrations",
    log: () => {},
  });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: TagRepository } = await import("../../src/repositories/PgTagRepository.js"));
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, pseudo) VALUES ('test@cocon.dev', 'x', 'testeur') RETURNING id_user`,
  );
  userId = rows[0].id_user;
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

test("les migrations créent les tables et les vues attendues", { skip }, async () => {
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const names = rows.map((row) => row.table_name);
  for (const name of ["users", "games", "reviews", "tags", "shares", "v_reviews_complete"]) {
    assert.ok(names.includes(name), `${name} manquant`);
  }
});

test("TagRepository crée puis retrouve un tag", { skip }, async () => {
  const tag = await TagRepository.create({ tagName: " RPG ", userId });
  assert.equal(tag.tagName, "RPG");

  const tags = await TagRepository.findByUserId(userId);
  assert.deepEqual(tags.map((t) => t.tagName), ["RPG"]);
});

test("TagRepository refuse un doublon, sans tenir compte de la casse", { skip }, async () => {
  await assert.rejects(TagRepository.create({ tagName: "rpg", userId }), /existe déjà/);
});

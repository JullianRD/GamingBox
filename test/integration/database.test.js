// Tests d'intégration : nécessitent une base PostgreSQL 18 vide dédiée aux tests.
// Lancement : TEST_DATABASE_URL=postgresql://... npm test
// Sans TEST_DATABASE_URL, ces tests sont ignorés.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
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

test("les migrations créent les tables attendues et retirent les tables héritées", { skip }, async () => {
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const names = rows.map((row) => row.table_name);
  for (const name of ["users", "tags", "items", "user_items", "lists", "follows", "activities", "entry_comments", "recommendations"]) {
    assert.ok(names.includes(name), `${name} manquant`);
  }
  for (const name of ["games", "reviews", "shares", "review_tags"]) {
    assert.ok(!names.includes(name), `${name} devrait être supprimée`);
  }
});

test("un utilisateur est public par défaut", { skip }, async () => {
  const { rows } = await db.query(`SELECT is_public FROM users WHERE id_user = $1`, [userId]);
  assert.equal(rows[0].is_public, true);
});

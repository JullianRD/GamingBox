import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://localhost/test";
process.env.LOG_LEVEL = "silent";
const { resolveSsl, pool } = await import("../../src/config/database.js");
await pool.end();

const neonUrl = "postgresql://user:pass@ep-x-pooler.eu-central-1.aws.neon.tech/cocon?sslmode=require";

test("active le SSL avec vérification des certificats pour une URL Neon", () => {
  assert.deepEqual(resolveSsl({ DATABASE_URL: neonUrl }), { rejectUnauthorized: true });
});

test("pas de SSL pour une base locale sans sslmode", () => {
  assert.equal(resolveSsl({ DATABASE_URL: "postgresql://localhost:5432/cocon_db_dev" }), false);
});

test("DB_SSL force ou désactive le SSL", () => {
  assert.equal(resolveSsl({ DATABASE_URL: neonUrl, DB_SSL: "false" }), false);
  assert.deepEqual(resolveSsl({ DATABASE_URL: "postgresql://localhost/x", DB_SSL: "true" }), { rejectUnauthorized: true });
});

test("la vérification des certificats ne se coupe qu'explicitement", () => {
  assert.deepEqual(
    resolveSsl({ DATABASE_URL: neonUrl, DB_SSL_REJECT_UNAUTHORIZED: "false" }),
    { rejectUnauthorized: false },
  );
});

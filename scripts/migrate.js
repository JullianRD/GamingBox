#!/usr/bin/env node
"use strict";
/**
 * Exécute les patches SQL de database/migrations/patches/ qui n'ont pas encore été
 * appliqués. L'historique est stocké dans la table `schema_migrations`.
 *
 * Usage : npm run migrate
 * Connexion : MIGRATE_DATABASE_URL (compte propriétaire du schéma) sinon DATABASE_URL.
 * Chaque patch s'exécute dans une transaction et doit rester idempotent (IF NOT EXISTS).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const PATCH_DIR = path.join(here, "..", "database", "migrations", "patches");

export async function migrate({ connectionString, log = console.log } = {}) {
  const url = connectionString || process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (ou MIGRATE_DATABASE_URL) manquante.");

  const client = new pg.Client({
    connectionString: url,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    const files = fs.readdirSync(PATCH_DIR).filter((f) => f.endsWith(".sql")).sort();
    const executed = [];

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(PATCH_DIR, file), "utf8");
      log(`-> ${file}`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        executed.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Patch ${file} en échec : ${error.message}`);
      }
    }

    log(executed.length ? `${executed.length} patch(es) appliqué(s).` : "Base à jour.");
    return executed;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

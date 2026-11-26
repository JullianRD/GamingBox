// Prépare une base PostgreSQL de test : schéma de base + patches, puis fournit des utilitaires.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrate } from "../../scripts/migrate.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const BASE_FILES = [
  "database/migrations/config/03_add_extensions.sql",
  "database/migrations/config/04_add_types.sql",
  "database/triggers/01_add_trigger_set_timestamp.sql",
  ...fs
    .readdirSync(path.join(ROOT, "database/migrations/tables"))
    .sort()
    .map((f) => `database/migrations/tables/${f}`),
  ...fs
    .readdirSync(path.join(ROOT, "database/vues"))
    .sort()
    .map((f) => `database/vues/${f}`),
];

export function adminUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "TEST_DATABASE_URL manquante (ex: postgresql://postgres@localhost:5433/gamingbox_test)",
    );
  return url;
}

/** Recrée entièrement le schéma public (base de test jetable !). */
export async function resetDatabase() {
  const url = adminUrl();
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error("Refus : le nom de la base de test doit contenir « test ».");
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

    // uuidv7() n'existe qu'à partir de PostgreSQL 18 : shim pour les versions antérieures
    const { rows } = await client.query("SELECT 1 FROM pg_proc WHERE proname = 'uuidv7'");
    if (!rows.length) {
      await client.query(
        "CREATE FUNCTION uuidv7() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()'",
      );
    }

    for (const file of BASE_FILES) {
      await client.query(fs.readFileSync(path.join(ROOT, file), "utf8"));
    }
  } finally {
    await client.end();
  }

  await migrate({ connectionString: url, log: () => {} });
}

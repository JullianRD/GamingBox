// Lance les migrations node-pg-migrate.
// Sur Neon, les migrations passent par la connexion directe (DATABASE_URL_UNPOOLED) :
// le pooler en mode transaction ne garde pas le verrou que pose node-pg-migrate.
// Usage : node scripts/migrate.js up|down [nombre]   (down 0 = tout annuler)
import "dotenv/config";
import { runner } from "node-pg-migrate";

const [direction = "up", rawCount] = process.argv.slice(2);

if (!["up", "down"].includes(direction)) {
  console.error("Usage : node scripts/migrate.js up|down [nombre]");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL (ou DATABASE_URL_UNPOOLED) manquant");
  process.exit(1);
}

const count = rawCount === undefined ? (direction === "up" ? Infinity : 1) : Number(rawCount);

try {
  const applied = await runner({
    databaseUrl,
    dir: "migrations",
    direction,
    count,
    migrationsTable: "pgmigrations",
    checkOrder: true,
    log: () => {},
  });
  console.log(
    applied.length
      ? `Migrations ${direction} : ${applied.map((m) => m.name).join(", ")}`
      : "Aucune migration à appliquer",
  );
} catch (error) {
  console.error(`Échec des migrations : ${error.message}`);
  process.exit(1);
}

// Parcours complet d'un import : lecture, correspondances, revue, application.
// Le CSV Cocon porte ses identifiants : aucun appel réseau.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let ImportService;
let ExportService;
let ItemRepository;
let UserItemRepository;
let userId;

const migrate = (direction) =>
  runner({ databaseUrl, dir: "migrations", direction, count: direction === "up" ? Infinity : 0, migrationsTable: "pgmigrations", log: () => {} });

const CSV = [
  "type,title,year,source,external_id,status,rating,review,favorite,tags,started_at,finished_at,cover_url",
  "movie,Heat,1995,tmdb,movie:949,completed,9,Culte,oui,polar,,2024-02-01,https://img/heat.jpg",
  "game,Hades,2020,igdb,113112,in_progress,,,,roguelike,2024-03-01,,",
  "game,Jeu sans source,2001,,,planned,,,,,,,",
].join("\n");

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  delete process.env.IGDB_CLIENT_ID;
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: ImportService } = await import("../../src/modules/imports/ImportService.js"));
  ({ default: ExportService } = await import("../../src/modules/imports/ExportService.js"));
  ({ default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js"));
  ({ default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js"));
  const { rows } = await db.query(`INSERT INTO users (email, password_hash, pseudo) VALUES ('imp@cocon.dev', 'x', 'imp') RETURNING id_user`);
  userId = rows[0].id_user;
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

const waitFor = async (importId, status) => {
  for (let i = 0; i < 100; i++) {
    const current = await ImportService.getImport(importId, userId);
    if (current.status === status) return current;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`statut ${status} jamais atteint`);
};

test("un import CSV passe par la revue puis remplit la bibliothèque sans écraser l'existant", { skip }, async () => {
  // Une note déjà saisie sur Heat doit survivre à l'import
  const heat = await ItemRepository.upsert({ type: "movie", source: "tmdb", externalId: "movie:949", title: "Heat", coverUrl: null });
  const existingId = await UserItemRepository.create(userId, heat.id, { status: "planned" });
  await UserItemRepository.update(existingId, userId, { rating: 7 });

  const created = await ImportService.create(userId, "csv", { buffer: Buffer.from(CSV), filename: "cocon.csv", options: { defaultType: "book" } });
  assert.equal(created.total, 3);

  const review = await waitFor(created.id, "review");
  assert.equal(review.counts.matched, 2);
  // Pas de source et IGDB non configuré en test : à vérifier
  assert.equal((review.counts.unmatched ?? 0) + (review.counts.ambiguous ?? 0), 1);

  const { toReview, matched } = await ImportService.getReview(created.id, userId);
  const skipped = await ImportService.toggleSkip(created.id, userId, toReview[0].id);
  assert.equal(skipped.state, "skipped");
  await assert.rejects(ImportService.chooseCandidate(created.id, userId, matched[0].id, 3), /Proposition introuvable/);

  await ImportService.apply(created.id, userId);
  const done = await waitFor(created.id, "done");
  assert.equal(done.counts.applied, 2);
  await assert.rejects(ImportService.apply(created.id, userId), /déjà appliqué/);

  const entry = await UserItemRepository.findByItemForUser(heat.id, userId);
  assert.equal(entry.rating, 7, "la note existante est gardée");
  assert.equal(entry.status, "completed", "le statut avance depuis « à voir »");
  assert.equal(entry.review, "Culte");
  assert.equal(entry.isFavorite, true);
  assert.deepEqual(entry.tags.map((t) => t.name), ["polar"]);
  assert.equal((await ItemRepository.findById(heat.id)).coverUrl, "https://img/heat.jpg", "la jaquette manquante est complétée");

  const { rows } = await db.query(
    `SELECT ui.status, ui.started_at, ui.metadata FROM user_items ui JOIN items i ON i.id_item = ui.item_id WHERE ui.user_id = $1 AND i.external_id = '113112'`,
    [userId],
  );
  assert.equal(rows[0].status, "in_progress");
  assert.equal(rows[0].metadata.importedFrom, "csv");

  // L'export Cocon se réimporte : mêmes œuvres, aucune recherche
  const csv = await ExportService.coconExport(userId);
  assert.match(csv, /tmdb,movie:949,completed,7,Culte,oui,polar/);
  const zip = await ExportService.letterboxdExport(userId);
  assert.ok(zip.length > 100);

  assert.equal((await ImportService.getImports(userId)).length, 1);
  assert.equal(await ImportService.remove(created.id, userId), true);
});

test("un import refuse une source inconnue ou un fichier vide", { skip }, async () => {
  await assert.rejects(ImportService.create(userId, "inconnue", {}), /inconnue/);
  await assert.rejects(ImportService.create(userId, "csv", {}), /Choisis un fichier/);
  await assert.rejects(ImportService.create(userId, "csv", { buffer: Buffer.from("titre\nSans type") , filename: "a.csv" }), /Aucune ligne/);
});

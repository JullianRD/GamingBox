// Catalogue local : moins d'appels d'API à mesure que la base se remplit
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let CatalogService;
let ItemRepository;
let matchRow;
let ImportService;
let anilist;
let openlibrary;
const calls = { search: 0, fetchItem: 0, similar: 0, match: 0 };
const original = {};

const migrate = (direction) =>
  runner({ databaseUrl, dir: "migrations", direction, count: direction === "up" ? Infinity : 0, migrationsTable: "pgmigrations", log: () => {} });

const manga = (id, title) => ({ type: "manga", source: "anilist", externalId: id, title, releaseDate: "2020-04-28", metadata: {} });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: CatalogService } = await import("../../src/modules/catalog/CatalogService.js"));
  ({ default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js"));
  ({ matchRow } = await import("../../src/modules/imports/ImportService.js"));
  ({ default: anilist } = await import("../../src/modules/catalog/providers/anilist.js"));
  ({ default: openlibrary } = await import("../../src/modules/catalog/providers/openlibrary.js"));
  Object.assign(original, { anilist: { ...anilist }, openlibrary: { ...openlibrary } });

  anilist.configured = () => true;
  anilist.search = async () => {
    calls.search++;
    return [manga("101", "Frieren"), manga("102", "Frieren: Beyond Journey's End Guidebook")];
  };
  anilist.match = async () => {
    calls.match++;
    return [manga("201", "Blue Period")];
  };
  anilist.fetchItem = async (id) => {
    calls.fetchItem++;
    return { ...manga(id, "Frieren"), metadata: { volumes: 14, ongoing: true } };
  };
  anilist.similar = async () => {
    calls.similar++;
    return [manga("301", "Dungeon Meshi")];
  };
  openlibrary.configured = () => true;
  openlibrary.search = async () => {
    calls.search++;
    return [];
  };
});

after(async () => {
  if (skip) return;
  Object.assign(anilist, original.anilist);
  Object.assign(openlibrary, original.openlibrary);
  await db.end();
  await migrate("down");
});

test("une recherche n'appelle l'API qu'une fois, et ses résultats restent en base", { skip }, async () => {
  const first = await CatalogService.search("Frieren", { type: "manga" });
  assert.equal(calls.search, 1);
  assert.deepEqual(first.results.map((r) => r.title).slice(0, 1), ["Frieren"]);
  assert.ok(first.results.every((r) => r.id), "résultats enregistrés dans items");

  const again = await CatalogService.search("frieren", { type: "manga" });
  assert.equal(calls.search, 1, "même requête : servie par search_cache");
  assert.equal(again.results.length, 2);
});

test("assez de résultats en base : pas d'API, sauf « Chercher plus loin »", { skip }, async () => {
  for (let i = 0; i < 6; i++) {
    await ItemRepository.upsert({ type: "book", source: "openlibrary", externalId: `D${i}`, title: `Dune tome ${i}` });
  }
  const local = await CatalogService.search("Dune", { type: "book" });
  assert.equal(calls.search, 1, "6 titres proches en base : l'API n'est pas appelée");
  assert.equal(local.canSearchDeeper, true);
  assert.equal(local.results.length, 6);

  const deep = await CatalogService.search("Dune", { type: "book", deep: true });
  assert.equal(calls.search, 2);
  assert.equal(deep.canSearchDeeper, false);
});

test("une fiche vue en recherche se complète une seule fois", { skip }, async () => {
  const item = await CatalogService.resolveItem("anilist", "101");
  assert.equal(calls.fetchItem, 1);
  assert.equal(item.metadata.volumes, 14);
  assert.equal(item.metadata.detailed, true);
  await CatalogService.resolveItem("anilist", "101");
  assert.equal(calls.fetchItem, 1, "fiche détaillée et fraîche : aucun appel");

  // Fiche périmée : servie tout de suite, relue en arrière-plan
  await db.query(`UPDATE items SET fetched_at = NOW() - INTERVAL '8 days' WHERE source = 'anilist' AND external_id = '101'`);
  await CatalogService.resolveItem("anilist", "101");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(calls.fetchItem, 2);
});

test("les similaires d'une œuvre sont gardés et partagés", { skip }, async () => {
  const seed = await ItemRepository.findBySource("anilist", "101");
  const first = await CatalogService.getSimilar(seed);
  const second = await CatalogService.getSimilar(seed);
  assert.equal(calls.similar, 1);
  assert.deepEqual(second.map((i) => i.title), first.map((i) => i.title));
  assert.ok(await ItemRepository.findBySource("anilist", "301"), "la suggestion est dans le catalogue");
});

test("un import trouve d'abord en base, puis réutilise les correspondances validées", { skip }, async () => {
  const fromLocal = await matchRow({ type: "manga", title: "Frieren", year: 2020 });
  assert.equal(fromLocal.state, "matched");
  assert.equal(calls.match, 0, "déjà au catalogue : pas d'appel");

  const fromApi = await matchRow({ type: "manga", title: "Blue Period", year: 2020 });
  assert.equal(calls.match, 1);
  assert.equal(fromApi.state, "matched");
  assert.ok(fromApi.match.id, "le candidat est enregistré en base");

  const { default: CatalogCacheRepository } = await import("../../src/modules/catalog/CatalogCacheRepository.js");
  const other = await ItemRepository.upsert(manga("999", "Mon titre maison"));
  await CatalogCacheRepository.recordImportMatch("manga", "titre perso|2019", other.id);
  const remembered = await matchRow({ type: "manga", title: "Titre perso", year: 2019 });
  assert.equal(remembered.match.id, other.id);
  assert.equal(calls.match, 1, "correspondance mémorisée : pas d'appel");
});

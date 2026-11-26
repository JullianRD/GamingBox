// Tests d'intégration du modèle générique (items, user_items, listes, favoris).
// Lancement : TEST_DATABASE_URL=postgresql://... npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let ItemRepository;
let UserItemRepository;
let ListService;
let userId;
let otherUserId;
let item;

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
  ({ default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js"));
  ({ default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js"));
  ({ default: ListService } = await import("../../src/modules/lists/ListService.js"));
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, pseudo) VALUES ('lib@cocon.dev', 'x', 'lib'), ('autre@cocon.dev', 'x', 'autre') RETURNING id_user`,
  );
  [userId, otherUserId] = rows.map((row) => row.id_user);
  item = await ItemRepository.upsert({
    type: "game",
    source: "igdb",
    externalId: 1942,
    title: "The Witcher 3",
    releaseDate: "2015-05-19",
    genres: ["RPG"],
  });
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

test("upsert ne duplique pas une œuvre de la même source", { skip }, async () => {
  const again = await ItemRepository.upsert({
    type: "game",
    source: "igdb",
    externalId: "1942",
    title: "The Witcher 3: Wild Hunt",
  });
  assert.equal(again.id, item.id);
  assert.equal(again.title, "The Witcher 3: Wild Hunt");
});

test("une entrée se crée une seule fois et se met à jour", { skip }, async () => {
  const id = await UserItemRepository.create(userId, item.id, { status: "planned" });
  assert.equal(await UserItemRepository.create(userId, item.id), id);

  const entry = await UserItemRepository.update(id, userId, { status: "completed", rating: 9 });
  assert.equal(entry.status, "completed");
  assert.equal(entry.rating, 9);
  assert.deepEqual(await UserItemRepository.countByStatus(userId, "game"), { completed: 1 });
});

test("un autre utilisateur ne voit ni ne modifie l'entrée", { skip }, async () => {
  const [entry] = await UserItemRepository.findAllByUser(userId);
  assert.equal(await UserItemRepository.findByIdForUser(entry.id, otherUserId), null);
  await UserItemRepository.update(entry.id, otherUserId, { rating: 1 });
  assert.equal((await UserItemRepository.findByIdForUser(entry.id, userId)).rating, 9);
  assert.equal(await UserItemRepository.delete(entry.id, otherUserId), false);
});

test("les tags se posent sans doublon et se retirent", { skip }, async () => {
  const [entry] = await UserItemRepository.findAllByUser(userId);
  await UserItemRepository.addTag(entry.id, userId, "coup de cœur");
  await UserItemRepository.addTag(entry.id, userId, "Coup de cœur");
  let { tags } = await UserItemRepository.findByIdForUser(entry.id, userId);
  assert.equal(tags.length, 1);

  await UserItemRepository.removeTag(entry.id, userId, tags[0].id);
  ({ tags } = await UserItemRepository.findByIdForUser(entry.id, userId));
  assert.equal(tags.length, 0);
});

test("les listes ont un slug unique et basculent une œuvre", { skip }, async () => {
  const first = await ListService.create(userId, { title: "Mes jeux préférés", type: "game" });
  const second = await ListService.create(userId, { title: "Mes jeux préférés" });
  assert.equal(first.slug, "mes-jeux-preferes");
  assert.equal(second.slug, "mes-jeux-preferes-2");

  const [entry] = await UserItemRepository.findAllByUser(userId);
  let { lists } = await ListService.toggleEntryInList(userId, entry.id, first.id);
  assert.equal(lists.find((l) => l.id === first.id).contains, true);
  ({ lists } = await ListService.toggleEntryInList(userId, entry.id, first.id));
  assert.equal(lists.find((l) => l.id === first.id).contains, false);
});

test("les personnages préférés basculent", { skip }, async () => {
  await ItemRepository.replaceEntities(item.id, "igdb", [
    { kind: "character", externalId: "7", name: "Geralt", imageUrl: null },
    { kind: "character", externalId: "8", name: "Ciri", imageUrl: null },
  ]);
  const entities = await ItemRepository.findEntities(item.id, userId);
  assert.deepEqual(
    entities.map((e) => e.name),
    ["Geralt", "Ciri"],
  );

  assert.equal(await ItemRepository.toggleFavoriteEntity(userId, entities[1].id, item.id), true);
  assert.deepEqual(
    (await ItemRepository.findFavoriteEntities(userId)).map((e) => e.name),
    ["Ciri"],
  );
  assert.equal(await ItemRepository.toggleFavoriteEntity(userId, entities[1].id, item.id), false);
  assert.equal((await ItemRepository.findById(item.id)).metadata.entitiesFetchedAt !== undefined, true);
});

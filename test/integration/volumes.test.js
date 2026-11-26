// Manga : collection de tomes (possédé, lu, total, « jusqu'au tome N »)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let VolumeService;
let userId;
let mangaEntry;
let gameEntry;

const migrate = (direction) =>
  runner({ databaseUrl, dir: "migrations", direction, count: direction === "up" ? Infinity : 0, migrationsTable: "pgmigrations", log: () => {} });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: VolumeService } = await import("../../src/modules/library/VolumeService.js"));
  const { default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js");
  const { default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js");
  const { rows } = await db.query(`INSERT INTO users (email, password_hash, pseudo) VALUES ('t@c.dev','x','lectrice') RETURNING id_user`);
  userId = rows[0].id_user;
  const manga = await ItemRepository.upsert({ type: "manga", source: "anilist", externalId: "m1", title: "Frieren", metadata: { volumes: 5 } });
  const game = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "g1", title: "Hades" });
  mangaEntry = await UserItemRepository.create(userId, manga.id, { status: "in_progress" });
  gameEntry = await UserItemRepository.create(userId, game.id, { status: "planned" });
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

const idOf = (entry) => entry.id ?? entry;

test("un clic fait tourner l'état d'un tome : possédé, lu, retiré", { skip }, async () => {
  let v = await VolumeService.get(idOf(mangaEntry), userId);
  assert.equal(v.total, 5, "total lu dans le catalogue");
  assert.equal(v.owned, 0);

  v = await VolumeService.cycle(idOf(mangaEntry), userId, "2");
  assert.equal(v.volumes[1].state, "owned");
  v = await VolumeService.cycle(idOf(mangaEntry), userId, "2");
  assert.equal(v.volumes[1].state, "read");
  assert.deepEqual([v.owned, v.read], [1, 1]);
  v = await VolumeService.cycle(idOf(mangaEntry), userId, "2");
  assert.equal(v.volumes[1].state, "none");
  await assert.rejects(VolumeService.cycle(idOf(mangaEntry), userId, "6"), /entre 1 et 5/);
});

test("« jusqu'au tome N » garde les tomes lus, et le total se règle à la main", { skip }, async () => {
  await VolumeService.cycle(idOf(mangaEntry), userId, "1");
  await VolumeService.cycle(idOf(mangaEntry), userId, "1"); // tome 1 lu
  let v = await VolumeService.ownUpTo(idOf(mangaEntry), userId, "4");
  assert.deepEqual(v.volumes.map((vol) => vol.state), ["read", "owned", "owned", "owned", "none"]);

  v = await VolumeService.setTotal(idOf(mangaEntry), userId, "12");
  assert.equal(v.total, 12);
  assert.ok(v.custom);
  v = await VolumeService.setTotal(idOf(mangaEntry), userId, "3");
  assert.equal(v.total, 3);
  assert.equal(v.owned, 3, "les tomes au-delà du nouveau total sont retirés");
});

test("les tomes ne concernent que le manga", { skip }, async () => {
  await assert.rejects(VolumeService.get(idOf(gameEntry), userId), /pas de tomes/);
});

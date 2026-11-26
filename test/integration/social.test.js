// Tests d'intégration du social : abonnements, visibilité, fil, commentaires.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let SocialService;
let LibraryService;
let ItemRepository;
let UserItemRepository;
let alice;
let bob;
let carol;
let entryId;

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
  ({ default: SocialService } = await import("../../src/modules/social/SocialService.js"));
  ({ default: LibraryService } = await import("../../src/modules/library/LibraryService.js"));
  ({ default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js"));
  ({ default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js"));
  const { rows } = await db.query(`
    INSERT INTO users (email, password_hash, pseudo, is_public) VALUES
      ('alice@cocon.dev', 'x', 'alice', true), ('bob@cocon.dev', 'x', 'bob', true), ('carol@cocon.dev', 'x', 'carol', false)
    RETURNING id_user`);
  [alice, bob, carol] = rows.map((row) => row.id_user);
  const item = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "1", title: "Hades" });
  entryId = await UserItemRepository.create(alice, item.id, { status: "planned" });
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

test("suivre deux fois dans les deux sens fait des amis, puis se désabonner", { skip }, async () => {
  let { relation } = await SocialService.toggleFollow(bob, "alice");
  assert.deepEqual(relation, { following: true, followedBy: false, friends: false });
  ({ relation } = await SocialService.toggleFollow(alice, "bob"));
  assert.equal(relation.friends, true);
  assert.deepEqual(
    (await SocialService.getFriends(alice)).map((u) => u.pseudo),
    ["bob"],
  );
  ({ relation } = await SocialService.toggleFollow(alice, "bob"));
  assert.equal(relation.following, false);
  await SocialService.toggleFollow(alice, "bob");
});

test("un profil privé est invisible et ne peut pas être suivi", { skip }, async () => {
  await assert.rejects(SocialService.getProfile("carol", alice), /introuvable/);
  await assert.rejects(SocialService.toggleFollow(alice, "carol"), /introuvable/);
  const own = await SocialService.getProfile("carol", carol);
  assert.equal(own.isSelf, true);
});

test("les changements de la fiche arrivent dans le fil des abonnés", { skip }, async () => {
  await LibraryService.update(entryId, alice, { status: "completed" });
  await LibraryService.update(entryId, alice, { rating: "8" });
  await LibraryService.update(entryId, alice, { rating: "10" }); // remplace la note précédente dans le fil
  const feed = await SocialService.getFeed(bob);
  const kinds = feed.filter((a) => a.user.pseudo === "alice").map((a) => a.kind);
  assert.deepEqual(kinds.sort(), ["followed", "rated", "status"].sort());
  assert.equal(feed.find((a) => a.kind === "rated").payload.rating, 10);
});

test("l'activité d'un profil privé n'apparaît pas chez les autres", { skip }, async () => {
  await db.query(`UPDATE users SET is_public = false WHERE id_user = $1`, [alice]);
  const feed = await SocialService.getFeed(bob);
  assert.equal(
    feed.some((a) => a.user.pseudo === "alice"),
    false,
  );
  await db.query(`UPDATE users SET is_public = true WHERE id_user = $1`, [alice]);
});

test(
  "commentaires : ajout, suppression par le propriétaire, refus sur un profil privé",
  { skip },
  async () => {
    const { comments } = await SocialService.addComment(entryId, bob, "  Bien joué !  ");
    assert.equal(comments[0].body, "Bien joué !");
    await assert.rejects(SocialService.addComment(entryId, bob, "   "), /vide/);
    await assert.rejects(SocialService.deleteComment(comments[0].id, carol), /introuvable/);
    const after = await SocialService.deleteComment(comments[0].id, alice);
    assert.equal(after.comments.length, 0);

    const carolItem = await ItemRepository.upsert({
      type: "game",
      source: "igdb",
      externalId: "2",
      title: "Celeste",
    });
    const carolEntry = await UserItemRepository.create(carol, carolItem.id);
    await assert.rejects(SocialService.addComment(carolEntry, bob, "Salut"), /introuvable/);
  },
);

// Recommandations du jour (connecteur simulé), tendances et recommandations entre amis
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let DiscoverService;
let RecommendationService;
let ItemRepository;
let UserItemRepository;
let providers;
let alice;
let bob;
let carol;
let entryId;

const migrate = (direction) =>
  runner({ databaseUrl, dir: "migrations", direction, count: direction === "up" ? Infinity : 0, migrationsTable: "pgmigrations", log: () => {} });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: DiscoverService } = await import("../../src/modules/discover/DiscoverService.js"));
  ({ default: RecommendationService } = await import("../../src/modules/discover/RecommendationService.js"));
  ({ default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js"));
  ({ default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js"));
  providers = await import("../../src/modules/catalog/providers/index.js");

  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, pseudo) VALUES ('a@d.dev','x','alice'), ('b@d.dev','x','bob'), ('c@d.dev','x','carol') RETURNING id_user`,
  );
  [alice, bob, carol] = rows.map((r) => r.id_user);
  // alice et bob sont amis ; carol suit alice sans réciprocité
  await db.query(`INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2), ($2, $1), ($3, $1)`, [alice, bob, carol]);

  const heat = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "1", title: "Hades" });
  entryId = await UserItemRepository.create(alice, heat.id, { status: "completed" });
  await UserItemRepository.update(entryId, alice, { rating: 9 });
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

test("les suggestions du jour partent des œuvres aimées et sont gardées pour la journée", { skip }, async () => {
  const igdb = providers.getProvider("igdb");
  const original = { configured: igdb.configured, similar: igdb.similar, trending: igdb.trending };
  let calls = 0;
  igdb.configured = () => true;
  igdb.similar = async (seed) => {
    calls++;
    assert.equal(seed.title, "Hades");
    return [
      { type: "game", source: "igdb", externalId: "1", title: "Hades" },
      { type: "game", source: "igdb", externalId: "2", title: "Dead Cells" },
      { type: "game", source: "igdb", externalId: "3", title: "Celeste" },
    ];
  };
  igdb.trending = async () => [{ type: "game", source: "igdb", externalId: "9", title: "Tendance" }];
  try {
    const [games] = await DiscoverService.getDailyPicks(alice, { types: ["game"] });
    assert.deepEqual(games.picks.map((p) => p.title).slice(0, 2), ["Dead Cells", "Celeste"], "Hades déjà suivi n'est pas reproposé");
    assert.equal(games.picks[0].meta, "Parce que tu as aimé Hades");
    assert.equal(games.picks.at(-1).meta, "Tendance cette semaine", "les tendances complètent");
    await DiscoverService.getDailyPicks(alice, { types: ["game"] });
    assert.equal(calls, 1, "calculé une seule fois par jour");
  } finally {
    Object.assign(igdb, original);
  }
});

test("les tendances Cocon comptent les ajouts de la semaine", { skip }, async () => {
  const { cocon } = await DiscoverService.getTrends("game");
  assert.equal(cocon[0].title, "Hades");
  assert.equal(cocon[0].meta, "1 personne cette semaine");
});

test("on recommande à ses amis, pas aux simples abonnés", { skip }, async () => {
  const sent = await RecommendationService.send(alice, entryId, [bob], "Tu vas adorer");
  assert.deepEqual(sent.map((f) => f.pseudo), ["bob"]);
  await assert.rejects(RecommendationService.send(alice, entryId, [carol], ""), /amis/);
  await assert.rejects(RecommendationService.send(alice, entryId, [], ""), /au moins un ami/);
  await assert.rejects(RecommendationService.send(bob, entryId, [alice], ""), /introuvable/);

  assert.equal(await RecommendationService.unseenCount(bob), 1);
  const [reco] = await RecommendationService.inbox(bob);
  assert.equal(reco.sender.pseudo, "alice");
  assert.equal(reco.message, "Tu vas adorer");
  assert.equal(reco.item.inLibrary, false);
  assert.match(reco.item.href, /^\/ajouter\/igdb\/1$/);

  await RecommendationService.markAllSeen(bob);
  assert.equal(await RecommendationService.unseenCount(bob), 0);
  // Renvoyer la même œuvre la fait remonter comme non lue
  await RecommendationService.send(alice, entryId, [bob], "Toujours pas ?");
  assert.equal(await RecommendationService.unseenCount(bob), 1);
  assert.equal((await RecommendationService.inbox(bob)).length, 1);
  assert.ok((await RecommendationService.sentFor(alice, reco.item && (await UserItemRepository.findByIdForUser(entryId, alice)).itemId)).has(bob));

  assert.equal(await RecommendationService.remove(bob, reco.id), true);
  assert.equal((await RecommendationService.inbox(bob)).length, 0);
});

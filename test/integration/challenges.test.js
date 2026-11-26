// Défis : duel sur la bibliothèque, blindtest des jaquettes, résultats et fil
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let ChallengeService;
let userId;
let otherId;

const migrate = (direction) =>
  runner({ databaseUrl, dir: "migrations", direction, count: direction === "up" ? Infinity : 0, migrationsTable: "pgmigrations", log: () => {} });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: ChallengeService } = await import("../../src/modules/challenges/ChallengeService.js"));
  const { default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js");
  const { default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js");
  const { rows } = await db.query(`INSERT INTO users (email, password_hash, pseudo) VALUES ('d@c.dev','x','duelliste'), ('o@c.dev','x','autre') RETURNING id_user`);
  [userId, otherId] = rows.map((r) => r.id_user);
  for (let i = 0; i < 10; i++) {
    const item = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: `d${i}`, title: `Jeu ${i}`, coverUrl: `https://img/${i}.jpg` });
    await UserItemRepository.create(userId, item.id, { status: i === 9 ? "planned" : "completed" });
  }
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

test("un duel de 8 sur la bibliothèque va jusqu'au vainqueur et passe dans le fil", { skip }, async () => {
  let state = await ChallengeService.startDuel(userId, { mode: "library", type: "game", size: "16" });
  assert.equal(state.contenders.length, 8, "9 jeux joués : tableau de 8 (les « à jouer » ne comptent pas)");
  assert.equal(state.title, "Ma bibliothèque · Jeux");
  let resultId = null;
  while (!resultId) ({ state, resultId } = await ChallengeService.chooseInDuel(userId, state, 1));

  const result = await ChallengeService.getResult(resultId, userId);
  assert.equal(result.payload.ranking.length, 8);
  assert.equal(result.payload.champion.title, result.payload.ranking[0].title);
  assert.equal((await ChallengeService.getResult(resultId, otherId)).isMine, false, "profil public : résultat visible");
  await db.query(`UPDATE users SET is_public = FALSE WHERE id_user = $1`, [userId]);
  await assert.rejects(ChallengeService.getResult(resultId, otherId), /introuvable/, "profil privé : résultat caché");
  await db.query(`UPDATE users SET is_public = TRUE WHERE id_user = $1`, [userId]);

  const { rows } = await db.query(`SELECT kind, item_id, payload FROM activities WHERE user_id = $1 AND kind = 'challenged'`, [userId]);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].item_id, "le vainqueur est une œuvre : sa jaquette accompagne l'activité");
  assert.equal(rows[0].payload.champion, result.payload.champion.title);

  await assert.rejects(ChallengeService.startDuel(userId, { mode: "characters" }), /Pas assez/);
  await assert.rejects(ChallengeService.startDuel(userId, { mode: "inconnu" }), /inconnu/);
});

test("le blindtest des jaquettes se joue sans réseau et entre au classement", { skip }, async () => {
  let state = await ChallengeService.startBlindtest(userId, { mode: "covers" });
  assert.ok(state.questions.length >= 3);
  const view = ChallengeService.blindtestView(state);
  assert.equal(view.question.options.length, 4);
  assert.equal("answer" in view.question, false);

  let resultId = null;
  let expected = 0;
  while (!resultId) {
    const q = state.questions[state.index];
    const choice = state.index % 2 === 0 ? q.answer : (q.answer + 1) % 4;
    if (choice === q.answer) expected++;
    state = ChallengeService.answerBlindtest(state, choice);
    assert.equal(ChallengeService.answerBlindtest(state, q.answer), state, "une seule réponse par question");
    ({ state, resultId } = await ChallengeService.nextBlindtest(userId, state));
  }
  const result = await ChallengeService.getResult(resultId, userId);
  assert.equal(result.score, expected);
  assert.equal(result.payload.recap.length, result.total);

  const board = await ChallengeService.leaderboard(userId);
  assert.equal(board.covers[0].pseudo, "duelliste");
  assert.equal((await ChallengeService.recentResults(userId)).length, 2);
});

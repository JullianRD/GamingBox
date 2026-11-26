import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
const { bracketSize, createBracket, choose, currentPair, ranking, progress, roundLabel } = await import("../../src/modules/challenges/bracket.js");
const { makeQuestion, buildQuiz, publicQuestion } = await import("../../src/modules/challenges/quiz.js");

const people = (n) => Array.from({ length: n }, (_, i) => ({ key: String(i), title: `P${i}` }));

test("bracketSize prend la plus grande puissance de 2 possible, au moins 4", () => {
  assert.equal(bracketSize(16, 40), 16);
  assert.equal(bracketSize(16, 11), 8);
  assert.equal(bracketSize(8, 5), 4);
  assert.equal(bracketSize(8, 3), 0);
});

test("un tournoi de 8 se joue en 7 duels et donne un classement complet", () => {
  let state = createBracket(people(8));
  assert.equal(progress(state).label, "Quarts de finale");
  let duels = 0;
  // Le participant de gauche gagne toujours
  while (state.champion === null) {
    const [left] = currentPair(state);
    assert.ok(left);
    state = choose(state, 0);
    duels++;
  }
  assert.equal(duels, 7);
  assert.equal(currentPair(state), null);
  const order = ranking(state);
  assert.equal(order.length, 8);
  assert.equal(order[0].title, "P0");
  assert.equal(order[1].title, "P4", "le finaliste est second");
  assert.equal(new Set(order.map((p) => p.key)).size, 8);
  assert.equal(choose(state, 1), state, "plus de choix après la finale");
});

test("choisir à droite fait avancer le second participant", () => {
  const state = choose(createBracket(people(4)), 1);
  assert.deepEqual(state.next, [1]);
  assert.deepEqual(state.eliminated, [0]);
  assert.equal(roundLabel(2), "Finale");
});

test("makeQuestion : quatre réponses distinctes dont la bonne", () => {
  const pool = ["Heat", "Alien", "Dune", "Heat", "Akira"].map((label) => ({ label }));
  const q = makeQuestion({ label: "Heat", prompt: "?", media: { kind: "image", url: "x" } }, pool, () => 0.3);
  assert.equal(q.options.length, 4);
  assert.equal(new Set(q.options).size, 4);
  assert.equal(q.options[q.answer], "Heat");
  assert.equal(makeQuestion({ label: "A" }, [{ label: "B" }, { label: "C" }]), null, "pas assez de leurres");
  assert.equal("answer" in publicQuestion(q), false, "la bonne réponse ne part pas au navigateur");
});

test("buildQuiz ne pose pas deux fois la même réponse", () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ label: `T${i % 12}`, prompt: "?", media: {} }));
  const quiz = buildQuiz(pool, { count: 10 });
  assert.equal(quiz.length, 10);
  assert.equal(new Set(quiz.map((q) => q.options[q.answer])).size, 10);
});

test("le fil ne répète pas le vainqueur d'un duel quand c'est une œuvre", async () => {
  const { describeActivity } = await import("../../src/modules/social/activityText.js");
  const payload = { game: "duel", title: "Jeux", champion: "Elden Ring", resultId: "r1" };
  assert.equal(describeActivity({ kind: "challenged", payload, item: { title: "Elden Ring" } }).detail, "(duel Jeux)");
  assert.equal(describeActivity({ kind: "challenged", payload, item: null }).detail, "Elden Ring (duel Jeux)");
  assert.equal(describeActivity({ kind: "challenged", payload: { game: "blindtest", title: "Musique", score: 7, total: 10 } }).detail, "7/10 au blindtest Musique");
});

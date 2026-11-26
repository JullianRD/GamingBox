import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
const { dailyShuffle, interleave, toCard, today } = await import("../../src/modules/discover/DiscoverService.js");

const item = (id, title = `Œuvre ${id}`) => ({ type: "movie", source: "tmdb", externalId: `movie:${id}`, title });

test("dailyShuffle est stable pour une même graine et change avec la graine", () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(dailyShuffle(list, "u1-2026-11-26"), dailyShuffle(list, "u1-2026-11-26"));
  assert.notDeepEqual(dailyShuffle(list, "u1-2026-11-26"), dailyShuffle(list, "u1-2026-11-27"));
  assert.deepEqual([...dailyShuffle(list, "x")].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8], "la liste d'origine n'est pas modifiée");
});

test("interleave alterne les graines, retire doublons et œuvres déjà suivies", () => {
  const groups = [
    { reason: "Parce que tu as aimé Heat", items: [item(1), item(2), item(3)] },
    { reason: "Parce que tu as aimé Alien", items: [item(2), item(4)] },
  ];
  const picks = interleave(groups, new Set(["tmdb:movie:3"]), 4);
  assert.deepEqual(picks.map((p) => p.externalId), ["movie:1", "movie:2", "movie:4"]);
  assert.equal(picks[0].meta, "Parce que tu as aimé Heat");
  assert.equal(picks[2].meta, "Parce que tu as aimé Alien");
  assert.equal(interleave([], new Set(), 6).length, 0);
});

test("toCard mène à l'aperçu d'ajout et today donne la date ISO", () => {
  assert.equal(toCard(item("603")).href, "/ajouter/tmdb/movie%3A603");
  assert.equal(today(new Date("2026-11-26T23:30:00Z")), "2026-11-26");
});

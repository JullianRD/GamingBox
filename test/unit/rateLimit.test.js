// Limiteur de débit par fournisseur et fraîcheur des fiches
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { acquire, pause, waitTime, retryAfterMs, resetLimits, RateLimitError } from "../../src/modules/catalog/rateLimit.js";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://localhost/test"; // isStale ne touche pas à la base
const { isStale } = await import("../../src/modules/catalog/CatalogService.js");

beforeEach(() => resetLimits());

test("le seau laisse passer la rafale puis fait patienter", async () => {
  for (let i = 0; i < 4; i++) await acquire("IGDB");
  assert.ok(waitTime("IGDB") > 0, "5e appel IGDB dans la même seconde : il faut attendre");
  await assert.rejects(acquire("IGDB", { maxWait: 10 }), RateLimitError);
});

test("une source en pause refuse les appels pressés", async () => {
  pause("AniList", 30_000);
  await assert.rejects(acquire("AniList", { maxWait: 1000 }), /quota atteint/);
  assert.equal(retryAfterMs("12"), 12_000);
  assert.equal(retryAfterMs(null), 60_000);
});

test("une fiche détaillée se relit après 30 jours, 7 si elle est en cours", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  const old = (days) => new Date(now - days * 86_400_000).toISOString();
  const classic = { releaseDate: "1999-03-31", metadata: { detailed: true } };
  assert.equal(isStale({ ...classic, fetchedAt: old(10) }, now), false);
  assert.equal(isStale({ ...classic, fetchedAt: old(31) }, now), true);
  const ongoing = { releaseDate: "2020-04-28", metadata: { detailed: true, ongoing: true } };
  assert.equal(isStale({ ...ongoing, fetchedAt: old(8) }, now), true);
  assert.equal(isStale({ releaseDate: "2026-06-01", metadata: { detailed: true }, fetchedAt: old(8) }, now), true, "sortie récente");
  assert.equal(isStale({ ...classic, metadata: {}, fetchedAt: old(400) }, now), false, "fiche légère : complétée à l'ouverture, pas relue");
});

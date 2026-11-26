import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";
process.env.IGDB_CLIENT_ID = "test-client";
process.env.IGDB_CLIENT_SECRET = "test-secret";

const { default: IgdbService } = await import("../../src/services/IgdbService.js");

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const rawGame = {
  id: 1942,
  name: "The Witcher 3: Wild Hunt",
  first_release_date: 1431993600,
  genres: [{ name: "Role-playing (RPG)" }],
  cover: { image_id: "co1wyy" },
};

test("mapGame convertit un jeu IGDB au format de l'application", () => {
  assert.deepEqual(IgdbService.mapGame(rawGame), {
    igdbId: 1942,
    gameTitle: "The Witcher 3: Wild Hunt",
    gameGenre: "Role-playing (RPG)",
    releaseDate: "2015-05-19",
    thumbnailUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
  });
});

test("mapGame gère un jeu sans genre, date ni jaquette", () => {
  const game = IgdbService.mapGame({ id: 1, name: "Inconnu" });
  assert.equal(game.gameGenre, "Inconnu");
  assert.equal(game.releaseDate, null);
  assert.equal(game.thumbnailUrl, null);
});

test("searchGames n'appelle pas IGDB pour une recherche trop courte", async () => {
  globalThis.fetch = () => assert.fail("fetch ne doit pas être appelé");
  assert.deepEqual(await IgdbService.searchGames("a"), []);
});

test("searchGames échappe les guillemets et mappe les résultats", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
    }
    return new Response(JSON.stringify([rawGame]));
  };

  const results = await IgdbService.searchGames('the "witcher"');

  const igdbCall = calls.find((call) => call.url.includes("api.igdb.com"));
  assert.match(igdbCall.options.body, /search "the \\"witcher\\"";/);
  assert.equal(results.length, 1);
  assert.equal(results[0].igdbId, 1942);
});

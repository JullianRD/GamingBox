import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.IGDB_CLIENT_ID = "client";
process.env.IGDB_CLIENT_SECRET = "secret";

const { default: IgdbService } = await import("../src/services/IgdbService.js");

function stubFetch() {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: String(options?.body ?? "") });
    if (String(url).includes("oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
    }
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          {
            id: 7,
            name: "Hades",
            first_release_date: 1600000000,
            genres: [{ name: "Roguelike" }],
            cover: { image_id: "co1" },
          },
          { id: 8, name: "Sans jaquette" },
        ]),
    };
  };
  return calls;
}

test("IGDB : mapping des résultats, valeurs par défaut, cache des recherches", async () => {
  const calls = stubFetch();

  const first = await IgdbService.searchGames("Hades");
  assert.equal(first.length, 2);
  assert.deepEqual(first[0], {
    igdbId: 7,
    gameTitle: "Hades",
    gameGenre: "Roguelike",
    releaseDate: "2020-09-13",
    thumbnailUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg",
  });
  assert.equal(first[1].gameGenre, "Inconnu");
  assert.equal(first[1].thumbnailUrl, null);

  const before = calls.length;
  const second = await IgdbService.searchGames("hades");
  assert.deepEqual(second, first, "résultat identique depuis le cache");
  assert.equal(calls.length, before, "aucun appel réseau supplémentaire");
});

test("IGDB : les guillemets et antislashs saisis ne peuvent pas fermer la chaîne de requête", async () => {
  const calls = stubFetch();
  await IgdbService.searchGames('x\\" ; fields *; where id > 0; "');
  const body = calls.at(-1).body;
  const match = /search "(.*)";\n/.exec(body);
  assert.ok(match, body);
  // Tous les " du texte saisi sont précédés d'un nombre impair d'antislashs (échappés)
  for (const m of match[1].matchAll(/(\\*)"/g)) {
    assert.equal(m[1].length % 2, 1, `guillemet non échappé dans : ${match[1]}`);
  }
});

test("IGDB : requêtes trop courtes ignorées, erreur API => 502 sans fuite du détail", async () => {
  const calls = stubFetch();
  assert.deepEqual(await IgdbService.searchGames("a"), []);
  assert.equal(calls.length, 0);

  globalThis.fetch = async (url) =>
    String(url).includes("oauth2")
      ? { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) }
      : { ok: false, status: 500, text: async () => "secret interne du fournisseur" };
  await assert.rejects(
    () => IgdbService.searchGames("erreur api"),
    (error) => error.statusCode === 502 && !/secret interne/.test(error.message),
  );
});

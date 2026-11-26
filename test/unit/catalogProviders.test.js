import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
const { igdbToItem } = await import("../../src/modules/catalog/providers/index.js");
const { default: IgdbService } = await import("../../src/services/IgdbService.js");

test("igdbToItem convertit un jeu IGDB en œuvre Cocon", () => {
  const item = igdbToItem({
    igdbId: 1942,
    gameTitle: "The Witcher 3",
    gameGenre: "RPG",
    releaseDate: "2015-05-19",
    thumbnailUrl: "https://images.igdb.com/x.jpg",
  });
  assert.deepEqual(item, {
    type: "game",
    source: "igdb",
    externalId: "1942",
    title: "The Witcher 3",
    releaseDate: "2015-05-19",
    coverUrl: "https://images.igdb.com/x.jpg",
    genres: ["RPG"],
    metadata: {},
  });
});

test("igdbToItem ignore le genre « Inconnu »", () => {
  assert.deepEqual(igdbToItem({ igdbId: 1, gameTitle: "X", gameGenre: "Inconnu" }).genres, []);
});

test("mapCharacter construit l'URL du portrait", () => {
  assert.deepEqual(IgdbService.mapCharacter({ id: 7, name: "Geralt", mug_shot: { image_id: "abc" } }), {
    kind: "character",
    externalId: "7",
    name: "Geralt",
    imageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_small/abc.jpg",
  });
  assert.equal(IgdbService.mapCharacter({ id: 8, name: "Ciri" }).imageUrl, null);
});

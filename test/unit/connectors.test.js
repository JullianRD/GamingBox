import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
const { parseTmdbId, tmdbToItem, tmdbDetails, tmdbCharacters } = await import("../../src/modules/catalog/providers/tmdb.js");
const { anilistToItem, anilistCharacters } = await import("../../src/modules/catalog/providers/anilist.js");
const { parseTheme, themesToEntities } = await import("../../src/modules/catalog/providers/jikan.js");
const { openLibraryToItem } = await import("../../src/modules/catalog/providers/openlibrary.js");
const { deezerToItem, deezerTrack } = await import("../../src/modules/catalog/providers/deezer.js");
const { mapLimit, yearOf } = await import("../../src/modules/catalog/http.js");

test("parseTmdbId distingue films et séries et rejette le reste", () => {
  assert.deepEqual(parseTmdbId("movie:603"), { media: "movie", id: "603" });
  assert.deepEqual(parseTmdbId("tv:1399"), { media: "tv", id: "1399" });
  assert.equal(parseTmdbId("603"), null);
  assert.equal(parseTmdbId("person:1"), null);
  assert.equal(parseTmdbId("tv:abc"), null);
});

test("tmdbToItem convertit un résultat de recherche (genres par id)", () => {
  const item = tmdbToItem({
    id: 603, media_type: "movie", title: "Matrix", original_title: "The Matrix",
    release_date: "1999-03-30", poster_path: "/p.jpg", genre_ids: [28, 878, 999], overview: "Neo.",
  });
  assert.equal(item.type, "movie");
  assert.equal(item.externalId, "movie:603");
  assert.equal(item.coverUrl, "https://image.tmdb.org/t/p/w500/p.jpg");
  assert.deepEqual(item.genres, ["Action", "Science-fiction"]);
  assert.equal(item.metadata.originalTitle, "The Matrix");

  const series = tmdbToItem({ id: 1399, name: "Game of Thrones", first_air_date: "", genre_ids: [] }, "tv");
  assert.equal(series.type, "series");
  assert.equal(series.externalId, "tv:1399");
  assert.equal(series.releaseDate, null);
  assert.equal(series.coverUrl, null);
});

test("tmdbDetails ajoute durée, réalisateurs et plateformes françaises", () => {
  const item = tmdbDetails(
    {
      id: 603, title: "Matrix", runtime: 136, genres: [{ name: "Action" }],
      credits: { crew: [{ job: "Director", name: "Lana Wachowski" }, { job: "Writer", name: "X" }] },
      "watch/providers": { results: { FR: { link: "https://tmdb/w", flatrate: [{ provider_name: "Netflix" }], free: [{ provider_name: "Netflix" }] } } },
    },
    "movie",
  );
  assert.equal(item.metadata.runtime, 136);
  assert.deepEqual(item.metadata.directors, ["Lana Wachowski"]);
  assert.deepEqual(item.metadata.watchProviders, ["Netflix"]);
  assert.equal(item.metadata.watchLink, "https://tmdb/w");

  const series = tmdbDetails({ id: 1, name: "S", episode_run_time: [50], number_of_seasons: 3, created_by: [{ name: "A" }] }, "tv");
  assert.equal(series.metadata.runtime, 50);
  assert.equal(series.metadata.seasons, 3);
  assert.deepEqual(series.metadata.directors, ["A"]);
  assert.deepEqual(series.metadata.watchProviders, []);
});

test("tmdbCharacters garde les rôles nommés", () => {
  const chars = tmdbCharacters(
    { id: 1, aggregate_credits: { cast: [
      { id: 10, name: "Kit Harington", profile_path: "/k.jpg", roles: [{ character: "Jon Snow / Aegon" }] },
      { id: 11, name: "Sans rôle", roles: [] },
    ] } },
    "tv",
  );
  assert.equal(chars.length, 1);
  assert.equal(chars[0].name, "Jon Snow");
  assert.equal(chars[0].externalId, "tv:1:10");
  assert.equal(chars[0].role, "Joué par Kit Harington");
});

test("anilistToItem gère anime et manga, et garde l'id MyAnimeList", () => {
  const anime = anilistToItem({
    id: 154587, idMal: 52991, type: "ANIME", format: "TV", episodes: 28,
    title: { userPreferred: "Sousou no Frieren", english: "Frieren", native: "葬送のフリーレン" },
    coverImage: { large: "https://a/c.jpg" }, startDate: { year: 2023, month: 9, day: 29 }, genres: ["Adventure", "Drama", "Fantasy", "X"],
  });
  assert.equal(anime.type, "anime");
  assert.equal(anime.externalId, "154587");
  assert.equal(anime.releaseDate, "2023-09-29");
  assert.equal(anime.metadata.idMal, 52991);
  assert.equal(anime.genres.length, 3);

  const manga = anilistToItem({ id: 1, type: "MANGA", title: { romaji: "Berserk" }, startDate: { year: 1989 } });
  assert.equal(manga.type, "manga");
  assert.equal(manga.title, "Berserk");
  assert.equal(manga.releaseDate, "1989-01-01");
});

test("anilistCharacters traduit le rôle", () => {
  const chars = anilistCharacters({ characters: { edges: [
    { role: "MAIN", node: { id: 1, name: { full: "Frieren" }, image: { medium: "i" } } },
    { role: "BACKGROUND", node: { id: 2, name: { userPreferred: "Himmel" } } },
  ] } });
  assert.deepEqual(chars.map((c) => c.role), ["Personnage principal", null]);
  assert.equal(chars[1].name, "Himmel");
});

test("parseTheme lit le format Jikan des openings", () => {
  assert.deepEqual(parseTheme('1: "Guren no Yumiya (紅蓮の弓矢)" by Linked Horizon (eps 1-13)'), {
    title: "Guren no Yumiya (紅蓮の弓矢)", artist: "Linked Horizon", episodes: "eps 1-13",
  });
  assert.deepEqual(parseTheme('"Yuusha" by YOASOBI'), { title: "Yuusha", artist: "YOASOBI", episodes: null });
  assert.equal(parseTheme("texte libre").title, "texte libre");
});

test("themesToEntities numérote openings et endings", () => {
  const songs = themesToEntities(52991, { openings: ['1: "Yuusha" by YOASOBI'], endings: ['"Anytime Anywhere" by milet'] });
  assert.deepEqual(songs.map((s) => s.externalId), ["52991:op:1", "52991:ed:1"]);
  assert.deepEqual(songs.map((s) => s.role), ["Opening 1", "Ending 1"]);
  assert.equal(songs[0].name, "Yuusha — YOASOBI");
  assert.equal(songs[0].source, "jikan");
});

test("openLibraryToItem convertit une œuvre", () => {
  const item = openLibraryToItem({ key: "/works/OL893415W", title: "Dune", first_publish_year: 1965, cover_i: 12, author_name: ["Frank Herbert"], subject: ["SF", "Desert", "Ecology", "X"] });
  assert.equal(item.externalId, "OL893415W");
  assert.equal(item.releaseDate, "1965-01-01");
  assert.equal(item.coverUrl, "https://covers.openlibrary.org/b/id/12-L.jpg");
  assert.deepEqual(item.metadata.authors, ["Frank Herbert"]);
  assert.equal(item.genres.length, 3);
});

test("deezerToItem et deezerTrack", () => {
  const album = deezerToItem({ id: 302127, title: "Discovery", release_date: "2001-03-07", cover_xl: "x", artist: { name: "Daft Punk" }, nb_tracks: 14, genres: { data: [{ name: "Electro" }] } });
  assert.equal(album.type, "music");
  assert.equal(album.externalId, "302127");
  assert.equal(album.metadata.artist, "Daft Punk");
  assert.deepEqual(album.genres, ["Electro"]);
  const track = deezerTrack({ id: 3135556, title: "Harder, Better (Remix)", title_short: "Harder, Better", artist: { name: "Daft Punk" }, preview: "p.mp3" });
  assert.deepEqual(track, { id: "3135556", title: "Harder, Better", artist: "Daft Punk", preview: "p.mp3", cover: null });
});

test("mapLimit respecte l'ordre et la concurrence", async () => {
  let running = 0;
  let peak = 0;
  const out = await mapLimit([5, 1, 3, 2], 2, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, n));
    running--;
    return n * 2;
  });
  assert.deepEqual(out, [10, 2, 6, 4]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapLimit([], 3, async () => 1), []);
  assert.equal(yearOf("2001-03-07"), 2001);
  assert.equal(yearOf(null), null);
});

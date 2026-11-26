import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8, unzipSync, strFromU8, gzipSync } from "fflate";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
const { parseCsv, parseCsvObjects, toCsv } = await import("../../src/modules/imports/csv.js");
const { normalizeTitle, pickMatch } = await import("../../src/modules/imports/matching.js");
const { default: letterboxd } = await import("../../src/modules/imports/sources/letterboxd.js");
const { goodreadsRows } = await import("../../src/modules/imports/sources/goodreads.js");
const { default: mal } = await import("../../src/modules/imports/sources/mal.js");
const { parseSteamProfile, steamRows } = await import("../../src/modules/imports/sources/steam.js");
const { traktRows } = await import("../../src/modules/imports/sources/trakt.js");
const { lastfmRows } = await import("../../src/modules/imports/sources/lastfm.js");
const { genericRows } = await import("../../src/modules/imports/sources/csv.js");
const { coconCsv, letterboxdCsv, COCON_HEADERS } = await import("../../src/modules/imports/ExportService.js");

test("parseCsv gère guillemets, virgules et retours à la ligne dans un champ", () => {
  const rows = parseCsv('a,b,c\r\n"x, y","il a dit ""oui""","ligne 1\nligne 2"\r\n\r\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["x, y", 'il a dit "oui"', "ligne 1\nligne 2"]]);
  assert.deepEqual(parseCsvObjects("﻿titre;note\nDune;8"), [{ titre: "Dune", note: "8" }]);
});

test("toCsv puis parseCsvObjects redonnent les mêmes valeurs", () => {
  const csv = toCsv(["a", "b"], [{ a: 'x,"y"', b: "l1\nl2" }, { a: null, b: 3 }]);
  assert.deepEqual(parseCsvObjects(csv), [{ a: 'x,"y"', b: "l1\nl2" }, { a: "", b: "3" }]);
});

test("normalizeTitle ignore accents, casse, article et ponctuation", () => {
  assert.equal(normalizeTitle("L'Été meurtrier !"), "ete meurtrier");
  assert.equal(normalizeTitle("The Lord of the Rings: The Two Towers"), normalizeTitle("Lord of the Rings - The Two Towers"));
});

test("pickMatch retient un titre identique de la bonne année", () => {
  const dune1984 = { type: "movie", title: "Dune", releaseDate: "1984-12-14" };
  const dune2021 = { type: "movie", title: "Dune", releaseDate: "2021-09-15" };
  const other = { type: "movie", title: "Dune: Part Two", releaseDate: "2024-02-28" };
  assert.equal(pickMatch({ title: "Dune", year: 2021 }, [dune1984, dune2021, other]).match, dune2021);
  // Sans année, deux « Dune » se valent : l'utilisateur tranche
  const unsure = pickMatch({ title: "Dune" }, [dune1984, dune2021]);
  assert.equal(unsure.state, "ambiguous");
  assert.equal(unsure.candidates.length, 2);
  assert.equal(pickMatch({ title: "Inconnu" }, []).state, "unmatched");
  assert.equal(pickMatch({ title: "Totalement autre", year: 1990 }, [other]).state, "ambiguous");
});

test("pickMatch départage par l'auteur ou l'artiste", () => {
  const a = { type: "music", title: "Greatest Hits", metadata: { artist: "Queen" } };
  const b = { type: "music", title: "Greatest Hits", metadata: { artist: "ABBA" } };
  assert.equal(pickMatch({ title: "Greatest Hits", creator: "Queen" }, [b, a]).match, a);
});

test("Letterboxd : le ZIP fusionne vus, notes, avis, journal, watchlist et likes", async () => {
  const csv = (header, ...lines) => strToU8([header, ...lines].join("\n"));
  const zip = zipSync({
    "watched.csv": csv("Date,Name,Year,Letterboxd URI", "2024-01-01,Dune,2021,https://boxd.it/a", "2024-01-02,Heat,1995,https://boxd.it/b"),
    "ratings.csv": csv("Date,Name,Year,Letterboxd URI,Rating", "2024-01-01,Dune,2021,https://boxd.it/a,4.5"),
    "reviews.csv": csv("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date", '2024-01-01,Dune,2021,u,4.5,,"Sable, vers et épices",imax,2024-01-01'),
    "diary.csv": csv("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date", "2024-03-01,Heat,1995,u,5,Yes,\"cinema, 35mm\",2024-02-28"),
    "watchlist.csv": csv("Date,Name,Year,Letterboxd URI", "2024-01-01,Perfect Days,2023,https://boxd.it/c"),
    "likes/films.csv": csv("Date,Name,Year,Letterboxd URI", "2024-01-01,Heat,1995,https://boxd.it/b"),
    "profile.csv": csv("x", "y"),
  });
  const { rows } = await letterboxd.read({ buffer: Buffer.from(zip), filename: "letterboxd-export.zip" });
  const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
  assert.equal(rows.length, 3);
  assert.equal(byTitle.Dune.rating, 9);
  assert.equal(byTitle.Dune.review, "Sable, vers et épices");
  assert.deepEqual(byTitle.Dune.tags, ["imax"]);
  assert.equal(byTitle.Heat.favorite, true);
  assert.equal(byTitle.Heat.rating, 10);
  assert.equal(byTitle.Heat.finishedAt, "2024-02-28");
  assert.deepEqual(byTitle.Heat.tags, ["cinema", "35mm"]);
  assert.equal(byTitle["Perfect Days"].status, "planned");
  assert.equal(byTitle["Perfect Days"].year, 2023);

  const single = await letterboxd.read({ buffer: Buffer.from("Date,Name,Year,Letterboxd URI\n2024,Alien,1979,u"), filename: "watchlist.csv" });
  assert.equal(single.rows[0].status, "planned");
  await assert.rejects(letterboxd.read({ buffer: Buffer.from("a,b\n1,2"), filename: "x.csv" }), /Letterboxd/);
});

test("Goodreads : étagères, note sur 10, ISBN nettoyé, série retirée du titre", () => {
  const [row] = goodreadsRows([
    { Title: "The Way of Kings (The Stormlight Archive, #1)", Author: "Brandon Sanderson", ISBN: '="0765326353"', ISBN13: '="9780765326355"', "My Rating": "5", "Original Publication Year": "2010", "Date Read": "2023/05/02", "Exclusive Shelf": "read", Bookshelves: "fantasy, favorites", "My Review": "" },
  ]);
  assert.equal(row.title, "The Way of Kings");
  assert.equal(row.ids.isbn, "9780765326355");
  assert.equal(row.rating, 10);
  assert.equal(row.status, "completed");
  assert.equal(row.finishedAt, "2023-05-02");
  assert.deepEqual(row.tags, ["fantasy"]);
});

test("MyAnimeList : XML compressé, statuts et dates vides", async () => {
  const xml = `<?xml version="1.0"?><myanimelist>
    <anime><series_animedb_id>52991</series_animedb_id><series_title><![CDATA[Sousou no Frieren]]></series_title>
      <my_score>10</my_score><my_status>Completed</my_status><my_start_date>2023-09-29</my_start_date><my_finish_date>0000-00-00</my_finish_date><my_tags><![CDATA[fantasy, cozy]]></my_tags></anime>
    <anime><series_animedb_id>1</series_animedb_id><series_title>Cowboy Bebop</series_title><my_score>0</my_score><my_status>Plan to Watch</my_status></anime>
  </myanimelist>`;
  const { rows } = await mal.read({ buffer: Buffer.from(gzipSync(strToU8(xml))), filename: "animelist.xml.gz" });
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { title: rows[0].title, status: rows[0].status, rating: rows[0].rating, startedAt: rows[0].startedAt, finishedAt: rows[0].finishedAt, mal: rows[0].ids.mal, tags: rows[0].tags },
    { title: "Sousou no Frieren", status: "completed", rating: 10, startedAt: "2023-09-29", finishedAt: null, mal: "52991", tags: ["fantasy", "cozy"] },
  );
  assert.equal(rows[1].status, "planned");
  assert.equal(rows[1].rating, null);
});

test("Steam : profil reconnu sous ses trois formes, jeux jamais lancés à jouer", () => {
  assert.deepEqual(parseSteamProfile("76561197960287930"), { steamId: "76561197960287930" });
  assert.deepEqual(parseSteamProfile("https://steamcommunity.com/profiles/76561197960287930/"), { steamId: "76561197960287930" });
  assert.deepEqual(parseSteamProfile("https://steamcommunity.com/id/gabelogannewell"), { vanity: "gabelogannewell" });
  assert.equal(parseSteamProfile("  "), null);
  const rows = steamRows([{ appid: 620, name: "Portal 2", playtime_forever: 900 }, { appid: 400, name: "Portal", playtime_forever: 0 }], { playedStatus: "completed" });
  assert.deepEqual(rows.map((r) => [r.ids.steam, r.status, r.playtime]), [["620", "completed", 900], ["400", "planned", 0]]);
});

test("Trakt : ids TMDB, série en cours si épisodes manquants, notes fusionnées", () => {
  const rows = traktRows({
    movies: [{ movie: { title: "Heat", year: 1995, ids: { trakt: 1, tmdb: 949 } }, last_watched_at: "2024-02-01T20:00:00Z" }],
    shows: [{ show: { title: "Severance", year: 2022, aired_episodes: 19, ids: { trakt: 2, tmdb: 95396 } }, seasons: [{ episodes: [{}, {}, {}] }] }],
    ratings: [{ rating: 9, movie: { title: "Heat", ids: { trakt: 1, tmdb: 949 } } }],
    watchlist: [{ movie: { title: "Alien", year: 1979, ids: { trakt: 3, tmdb: 348 } } }],
  });
  const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
  assert.equal(byTitle.Heat.ids.tmdb, "movie:949");
  assert.equal(byTitle.Heat.rating, 9);
  assert.equal(byTitle.Heat.finishedAt, "2024-02-01");
  assert.equal(byTitle.Severance.type, "series");
  assert.equal(byTitle.Severance.ids.tmdb, "tv:95396");
  assert.equal(byTitle.Severance.status, "in_progress");
  assert.equal(byTitle.Alien.status, "planned");
});

test("Last.fm : albums avec artiste, les premiers en favoris", () => {
  const rows = lastfmRows([{ name: "Discovery", artist: { name: "Daft Punk" }, playcount: "500" }, { name: "", artist: { name: "X" } }], { favorites: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].creator, "Daft Punk");
  assert.equal(rows[0].favorite, true);
});

test("CSV générique : colonnes françaises, libellés de statut et export Cocon réimportable", () => {
  const rows = genericRows(parseCsvObjects("Catégorie;Titre;Année;Statut;Note;Favori\nFilms;Heat;1995;Vu;9;oui\nJeux;Hades;2020;en cours;;"));
  assert.deepEqual(rows.map((r) => [r.type, r.title, r.status, r.rating, r.favorite]), [
    ["movie", "Heat", "completed", 9, true],
    ["game", "Hades", "in_progress", null, false],
  ]);

  const exported = coconCsv([{ item_type: "movie", title: "Heat", release_date: new Date("1995-12-15"), source: "tmdb", external_id: "movie:949", status: "completed", rating: 9, review: "Culte, vraiment", is_favorite: true, tags: "polar", started_at: null, finished_at: new Date("2024-02-01"), cover_url: "c.jpg" }]);
  assert.equal(exported.split("\r\n")[0], COCON_HEADERS.join(","));
  const [again] = genericRows(parseCsvObjects(exported));
  assert.equal(again.item.source, "tmdb");
  assert.equal(again.item.externalId, "movie:949");
  assert.equal(again.item.coverUrl, "c.jpg");
  assert.equal(again.review, "Culte, vraiment");
  assert.equal(again.finishedAt, "2024-02-01");
  assert.deepEqual(again.tags, ["polar"]);
});

test("Export Letterboxd : id TMDB et note sur 10", () => {
  const csv = letterboxdCsv([{ source: "tmdb", external_id: "movie:949", title: "Heat", release_date: new Date("1995-12-15"), rating: 9, finished_at: null, tags: "", review: null }]);
  assert.deepEqual(parseCsvObjects(csv)[0], { tmdbID: "949", Title: "Heat", Year: "1995", Rating10: "9", WatchedDate: "", Tags: "", Review: "" });
  assert.ok(unzipSync && strFromU8);
});

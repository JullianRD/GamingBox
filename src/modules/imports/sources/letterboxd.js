"use strict";

import { unzipSync, strFromU8 } from "fflate";
import { parseCsvObjects } from "../csv.js";
import { AppError } from "../../../utils/AppError.js";

/**
 * Letterboxd : export ZIP (Réglages > Données) ou un des CSV qu'il contient.
 * Les fichiers sont fusionnés par film (titre + année) :
 * watched, ratings, reviews, diary, watchlist et likes/films.
 */

const keyOf = (r) => `${r.Name}|${r.Year}`;
const toRating = (value) => {
  const n = Number(value);
  return n > 0 ? Math.min(10, Math.round(n * 2)) : null;
};
const toTags = (value) => (value ? value.split(",").map((t) => t.trim()).filter(Boolean) : []);

// Fichier CSV seul : son type se devine par ses colonnes
const guessKind = (rows) => {
  const cols = Object.keys(rows[0] ?? {});
  if (cols.includes("Review")) return "reviews";
  if (cols.includes("Watched Date")) return "diary";
  if (cols.includes("Rating")) return "ratings";
  return "watched";
};

export const mergeLetterboxd = (files) => {
  const films = new Map();
  const film = (r) => {
    const key = keyOf(r);
    if (!films.has(key)) {
      films.set(key, {
        type: "movie",
        title: r.Name,
        year: Number(r.Year) || null,
        status: "completed",
        rating: null,
        review: null,
        finishedAt: null,
        favorite: false,
        tags: [],
        ids: { letterboxd: r["Letterboxd URI"] || undefined },
      });
    }
    return films.get(key);
  };

  for (const r of files.watchlist ?? []) Object.assign(film(r), { status: "planned" });
  for (const r of files.watched ?? []) film(r).status = "completed";
  for (const r of files.diary ?? []) {
    const f = film(r);
    f.status = "completed";
    const date = r["Watched Date"] || null;
    if (date && (!f.finishedAt || date > f.finishedAt)) f.finishedAt = date;
    f.tags = [...new Set([...f.tags, ...toTags(r.Tags)])];
    f.rating = toRating(r.Rating) ?? f.rating;
  }
  for (const r of files.ratings ?? []) {
    const f = film(r);
    f.status = "completed";
    f.rating = toRating(r.Rating) ?? f.rating;
  }
  for (const r of files.reviews ?? []) {
    const f = film(r);
    f.status = "completed";
    if (r.Review) f.review = f.review ? `${f.review}\n\n${r.Review}` : r.Review;
    f.rating = toRating(r.Rating) ?? f.rating;
    f.tags = [...new Set([...f.tags, ...toTags(r.Tags)])];
  }
  for (const r of files.likes ?? []) film(r).favorite = true;
  return [...films.values()].filter((f) => f.title);
};

const FILES = {
  "watched.csv": "watched",
  "ratings.csv": "ratings",
  "reviews.csv": "reviews",
  "diary.csv": "diary",
  "watchlist.csv": "watchlist",
  "likes/films.csv": "likes",
};

export default {
  key: "letterboxd",
  label: "Letterboxd",
  types: ["movie"],
  input: "file",
  accept: ".zip,.csv",
  hint: "Sur Letterboxd : Réglages, Données, Export your data. Dépose le ZIP tel quel.",
  configured: () => true,
  async read({ buffer, filename }) {
    const files = {};
    if (/\.zip$/i.test(filename)) {
      let entries;
      try {
        entries = unzipSync(new Uint8Array(buffer), { filter: (f) => Object.keys(FILES).includes(f.name) });
      } catch {
        throw new AppError("Ce ZIP est illisible.", 400);
      }
      for (const [name, data] of Object.entries(entries)) files[FILES[name]] = parseCsvObjects(strFromU8(data));
      if (!Object.keys(files).length) throw new AppError("Ce ZIP ne ressemble pas à un export Letterboxd.", 400);
    } else {
      const rows = parseCsvObjects(buffer.toString("utf8"));
      if (!rows.length || !("Name" in rows[0])) throw new AppError("Ce CSV ne ressemble pas à un export Letterboxd.", 400);
      files[/watchlist/i.test(filename) ? "watchlist" : guessKind(rows)] = rows;
    }
    return { label: filename, rows: mergeLetterboxd(files) };
  },
};

"use strict";

import { parseCsvObjects } from "../csv.js";
import { AppError } from "../../../utils/AppError.js";

/**
 * Goodreads : export CSV (My Books > Import and export).
 * Correspondance par ISBN chez Open Library, puis par titre et auteur.
 */

const SHELVES = { read: "completed", "currently-reading": "in_progress", "to-read": "planned" };
const cleanIsbn = (value) => String(value ?? "").replace(/[^0-9X]/gi, "") || undefined;
const date = (value) => (value ? value.replace(/\//g, "-") : null);

export const goodreadsRows = (records) =>
  records
    .filter((r) => r.Title)
    .map((r) => {
      const rating = Number(r["My Rating"]);
      const shelves = (r.Bookshelves ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      return {
        type: "book",
        // « Titre (Série, #2) » : la série gêne la recherche
        title: r.Title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, ""),
        year: Number(r["Original Publication Year"] || r["Year Published"]) || null,
        creator: r.Author || null,
        status: SHELVES[r["Exclusive Shelf"]] ?? "planned",
        rating: rating > 0 ? rating * 2 : null,
        review: r["My Review"] || null,
        finishedAt: date(r["Date Read"]),
        favorite: false,
        tags: shelves.filter((s) => !SHELVES[s] && s !== "favorites"),
        ids: { isbn: cleanIsbn(r.ISBN13) || cleanIsbn(r.ISBN) },
      };
    });

export default {
  key: "goodreads",
  label: "Goodreads",
  types: ["book"],
  input: "file",
  accept: ".csv",
  hint: "Sur Goodreads : My Books, Import and export, Export Library. Dépose le CSV.",
  configured: () => true,
  async read({ buffer, filename }) {
    const records = parseCsvObjects(buffer.toString("utf8"));
    if (!records.length || !("Exclusive Shelf" in records[0])) throw new AppError("Ce CSV ne ressemble pas à un export Goodreads.", 400);
    return { label: filename, rows: goodreadsRows(records) };
  },
};

"use strict";

import { zipSync, strToU8 } from "fflate";
import db from "../../config/database.js";
import { toCsv } from "./csv.js";

/**
 * Exports de la bibliothèque :
 * - CSV Cocon (toutes catégories, réimportable tel quel)
 * - ZIP Letterboxd (films vus et watchlist, au format de l'import Letterboxd)
 */

const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const findEntries = async (userId, type = null) => {
  const { rows } = await db.query(
    `
      SELECT i.item_type, i.title, i.release_date, i.source, i.external_id, i.cover_url,
             ui.status, ui.rating, ui.review, ui.is_favorite, ui.started_at, ui.finished_at,
             COALESCE((SELECT string_agg(t.tag_name, ', ' ORDER BY t.tag_name)
                       FROM user_item_tags uit JOIN tags t ON t.id_tag = uit.tag_id
                       WHERE uit.user_item_id = ui.id_user_item), '') AS tags
      FROM user_items ui JOIN items i ON i.id_item = ui.item_id
      WHERE ui.user_id = $1 AND ($2::item_type_enum IS NULL OR i.item_type = $2)
      ORDER BY i.item_type, i.title
    `,
    [userId, type],
  );
  return rows;
};

export const COCON_HEADERS = [
  "type", "title", "year", "source", "external_id", "status", "rating", "review",
  "favorite", "tags", "started_at", "finished_at", "cover_url",
];

export const coconCsv = (rows) =>
  toCsv(
    COCON_HEADERS,
    rows.map((r) => ({
      type: r.item_type,
      title: r.title,
      year: r.release_date ? new Date(r.release_date).getFullYear() : "",
      source: r.source,
      external_id: r.external_id,
      status: r.status,
      rating: r.rating ?? "",
      review: r.review ?? "",
      favorite: r.is_favorite ? "oui" : "",
      tags: r.tags,
      started_at: isoDate(r.started_at),
      finished_at: isoDate(r.finished_at),
      cover_url: r.cover_url ?? "",
    })),
  );

const LETTERBOXD_HEADERS = ["tmdbID", "Title", "Year", "Rating10", "WatchedDate", "Tags", "Review"];

export const letterboxdCsv = (rows) =>
  toCsv(
    LETTERBOXD_HEADERS,
    rows.map((r) => ({
      tmdbID: r.source === "tmdb" ? String(r.external_id).replace(/^movie:/, "") : "",
      Title: r.title,
      Year: r.release_date ? new Date(r.release_date).getFullYear() : "",
      Rating10: r.rating ?? "",
      WatchedDate: isoDate(r.finished_at),
      Tags: r.tags,
      Review: r.review ?? "",
    })),
  );

class ExportService {
  static async coconExport(userId) {
    return coconCsv(await findEntries(userId));
  }

  static async letterboxdExport(userId) {
    const movies = await findEntries(userId, "movie");
    return zipSync({
      "cocon-letterboxd-vus.csv": strToU8(letterboxdCsv(movies.filter((m) => m.status !== "planned"))),
      "cocon-letterboxd-watchlist.csv": strToU8(letterboxdCsv(movies.filter((m) => m.status === "planned"))),
    });
  }
}

export default ExportService;

"use strict";

import { gunzipSync, strFromU8 } from "fflate";
import { AppError } from "../../../utils/AppError.js";
import { getProvider } from "../../catalog/providers/index.js";

/**
 * MyAnimeList : export XML (Profil > Export), anime ou manga, .xml ou .xml.gz.
 * Correspondance directe par id MAL chez AniList.
 */

const STATUSES = {
  Completed: "completed",
  Watching: "in_progress",
  Reading: "in_progress",
  "On-Hold": "paused",
  Dropped: "dropped",
  "Plan to Watch": "planned",
  "Plan to Read": "planned",
};

const tag = (block, name) => {
  const match = block.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${name}>`));
  return match ? (match[1] ?? match[2] ?? "").trim() : "";
};
const date = (value) => (value && !value.startsWith("0000") ? value : null);

export const parseMalXml = (xml) => {
  const rows = [];
  for (const [, kind, block] of xml.matchAll(/<(anime|manga)>([\s\S]*?)<\/\1>/g)) {
    const isAnime = kind === "anime";
    const score = Number(tag(block, "my_score"));
    rows.push({
      type: kind,
      title: tag(block, isAnime ? "series_title" : "manga_title"),
      year: null,
      status: STATUSES[tag(block, "my_status")] ?? "planned",
      rating: score > 0 ? score : null,
      review: null,
      startedAt: date(tag(block, "my_start_date")),
      finishedAt: date(tag(block, "my_finish_date")),
      favorite: false,
      tags: tag(block, "my_tags").split(",").map((t) => t.trim()).filter(Boolean),
      ids: { mal: tag(block, isAnime ? "series_animedb_id" : "manga_mangadb_id") },
    });
  }
  return rows.filter((r) => r.title && r.ids.mal);
};

export default {
  key: "mal",
  label: "MyAnimeList",
  types: ["anime", "manga"],
  input: "file",
  accept: ".xml,.gz",
  hint: "Sur MyAnimeList : Profil, Export, puis anime ou manga. Le fichier .xml.gz convient.",
  configured: () => true,
  async read({ buffer, filename }) {
    let xml;
    try {
      xml = /\.gz$/i.test(filename) ? strFromU8(gunzipSync(new Uint8Array(buffer))) : buffer.toString("utf8");
    } catch {
      throw new AppError("Ce fichier est illisible.", 400);
    }
    const rows = parseMalXml(xml);
    if (!rows.length) throw new AppError("Aucune œuvre trouvée dans cet export MyAnimeList.", 400);
    return { label: filename, rows };
  },
  // Une requête AniList pour 50 œuvres
  async matchBatch(rows) {
    const anilist = getProvider("anilist");
    const found = new Map();
    for (const type of ["anime", "manga"]) {
      const ids = rows.filter((r) => r.type === type).map((r) => r.ids.mal);
      if (ids.length) for (const [id, item] of await anilist.findByMalIds(ids, type)) found.set(`${type}:${id}`, item);
    }
    return rows.map((r) => found.get(`${r.type}:${r.ids.mal}`) ?? null);
  },
};

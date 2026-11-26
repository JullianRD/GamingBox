"use strict";

import { parseCsvObjects } from "../csv.js";
import { AppError } from "../../../utils/AppError.js";
import { ITEM_TYPES, STATUSES } from "../../../utils/itemTypes.js";

/**
 * CSV générique : réimport d'un export Cocon ou fichier fait main.
 * Colonnes reconnues (français ou anglais) : type, titre, année, auteur,
 * statut, note (sur 10), avis, favori, tags, debut, fin.
 * Un export Cocon porte aussi source et external_id : pas de recherche.
 */

const ALIASES = {
  type: ["type", "categorie", "catégorie", "category"],
  title: ["title", "titre", "name", "nom"],
  year: ["year", "annee", "année"],
  creator: ["creator", "auteur", "author", "artiste", "artist"],
  status: ["status", "statut"],
  rating: ["rating", "note"],
  review: ["review", "avis"],
  favorite: ["favorite", "favori"],
  tags: ["tags"],
  startedAt: ["started_at", "debut", "début"],
  finishedAt: ["finished_at", "fin"],
  source: ["source"],
  externalId: ["external_id"],
  coverUrl: ["cover_url"],
};

const TYPE_WORDS = Object.fromEntries(
  Object.values(ITEM_TYPES).flatMap((t) => [t.code, t.label, t.plural].map((w) => [w.toLowerCase(), t.code])),
);
const STATUS_WORDS = Object.fromEntries(
  Object.values(ITEM_TYPES).flatMap((t) => Object.entries(t.statusLabels).map(([code, label]) => [label.toLowerCase(), code])),
);

const pick = (record, field) => {
  const key = Object.keys(record).find((k) => ALIASES[field].includes(k.toLowerCase()));
  return key ? record[key] : "";
};

export const genericRows = (records, { defaultType = null } = {}) =>
  records
    .map((record) => {
      const get = (field) => pick(record, field);
      const type = TYPE_WORDS[get("type").toLowerCase()] ?? defaultType;
      const statusWord = get("status").toLowerCase();
      const rating = Math.round(Number(get("rating").replace(",", ".")));
      const row = {
        type,
        title: get("title"),
        year: Number(get("year")) || null,
        creator: get("creator") || null,
        status: STATUSES.includes(statusWord) ? statusWord : STATUS_WORDS[statusWord] ?? "planned",
        rating: rating >= 1 && rating <= 10 ? rating : null,
        review: get("review") || null,
        favorite: ["1", "true", "oui", "yes"].includes(get("favorite").toLowerCase()),
        tags: get("tags").split(/[,|]/).map((t) => t.trim()).filter(Boolean),
        startedAt: get("startedAt") || null,
        finishedAt: get("finishedAt") || null,
        ids: {},
      };
      if (get("source") && get("externalId") && type) {
        row.item = {
          type,
          source: get("source"),
          externalId: get("externalId"),
          title: row.title,
          releaseDate: row.year ? `${row.year}-01-01` : null,
          coverUrl: get("coverUrl") || null,
          genres: [],
          metadata: {},
        };
      }
      return row;
    })
    .filter((r) => r.title && r.type);

export default {
  key: "csv",
  label: "CSV",
  types: Object.keys(ITEM_TYPES),
  input: "file",
  accept: ".csv",
  hint: "Colonnes : type, titre, année, statut, note (sur 10), avis, favori, tags. Un export Cocon se réimporte tel quel.",
  options: [
    { name: "defaultType", label: "Catégorie si la colonne type manque", choices: [["", "Aucune"], ...Object.values(ITEM_TYPES).map((t) => [t.code, t.plural])] },
  ],
  configured: () => true,
  async read({ buffer, filename, options = {} }) {
    const rows = genericRows(parseCsvObjects(buffer.toString("utf8")), { defaultType: options.defaultType || null });
    if (!rows.length) throw new AppError("Aucune ligne exploitable : il faut au moins un titre et une catégorie.", 400);
    return { label: filename, rows };
  },
};

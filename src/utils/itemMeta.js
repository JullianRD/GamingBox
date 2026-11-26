"use strict";

const year = (date) => (date ? new Date(date).getFullYear() : null);

const duration = (minutes) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};

/**
 * Ligne d'informations d'une œuvre selon sa catégorie :
 * « 2024 · Denis Villeneuve · 2 h 46 », « 2013 · 25 épisodes · Action »...
 */
export const itemMeta = (item) => {
  const m = item.metadata ?? item.itemMetadata ?? {};
  const parts = [year(item.releaseDate)];
  switch (item.type) {
    case "movie":
      parts.push(m.directors?.slice(0, 2).join(", "), duration(m.runtime));
      break;
    case "series":
      parts.push(m.directors?.slice(0, 2).join(", "), m.seasons ? `${m.seasons} saison${m.seasons > 1 ? "s" : ""}` : null);
      break;
    case "anime":
      parts.push(m.episodes ? `${m.episodes} épisodes` : null);
      break;
    case "manga":
      parts.push(m.volumes ? `${m.volumes} tomes` : m.chapters ? `${m.chapters} chapitres` : null);
      break;
    case "book":
      parts.push(m.authors?.slice(0, 2).join(", "));
      break;
    case "music":
      parts.push(m.artist, m.tracks ? `${m.tracks} titres` : null);
      break;
    default:
      break;
  }
  parts.push(...(item.genres ?? []).slice(0, 2));
  return parts.filter(Boolean).join(" · ");
};

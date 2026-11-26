"use strict";

import { fetchJson, yearOf } from "../http.js";

/**
 * Films et séries : The Movie Database (TMDB), en français.
 * Identifiant externe : « movie:603 » ou « tv:1399 » (les deux espaces d'id se chevauchent).
 * Authentification : TMDB_API_TOKEN (jeton de lecture v4) ou TMDB_API_KEY (clé v3).
 */

const API = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p";

// Genres TMDB (ids stables) pour les résultats de recherche, qui ne donnent que des ids
export const TMDB_GENRES = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime", 99: "Documentaire",
  18: "Drame", 10751: "Familial", 14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Science-fiction", 10770: "Téléfilm", 53: "Thriller",
  10752: "Guerre", 37: "Western", 10759: "Action & aventure", 10762: "Enfants", 10763: "Actualités",
  10764: "Téléréalité", 10765: "Science-fiction & fantastique", 10766: "Feuilleton", 10767: "Talk-show",
  10768: "Guerre & politique",
};

const request = (path, params = {}) => {
  const url = new URL(`${API}${path}`);
  url.searchParams.set("language", "fr-FR");
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, value);
  const headers = {};
  if (process.env.TMDB_API_TOKEN) headers.Authorization = `Bearer ${process.env.TMDB_API_TOKEN}`;
  else if (process.env.TMDB_API_KEY) url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  return fetchJson("TMDB", url, { headers });
};

export const parseTmdbId = (externalId) => {
  const [media, id] = String(externalId).split(":");
  if (!["movie", "tv"].includes(media) || !/^\d+$/.test(id ?? "")) return null;
  return { media, id };
};

// Résultat TMDB (recherche, tendances, recommandations ou fiche) vers une œuvre Cocon
export const tmdbToItem = (result, mediaHint) => {
  const media = result.media_type ?? mediaHint;
  const isMovie = media === "movie";
  const genres = result.genres ? result.genres.map((g) => g.name) : (result.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean);
  return {
    type: isMovie ? "movie" : "series",
    source: "tmdb",
    externalId: `${isMovie ? "movie" : "tv"}:${result.id}`,
    title: isMovie ? result.title : result.name,
    releaseDate: (isMovie ? result.release_date : result.first_air_date) || null,
    coverUrl: result.poster_path ? `${IMAGE}/w500${result.poster_path}` : null,
    genres: genres.slice(0, 3),
    metadata: {
      originalTitle: isMovie ? result.original_title : result.original_name,
      overview: result.overview || undefined,
    },
  };
};

// Détails propres aux fiches : durée, réalisateurs, saisons, plateformes en France
export const tmdbDetails = (data, media) => {
  const item = tmdbToItem(data, media);
  const providers = data["watch/providers"]?.results?.FR;
  const streaming = [...(providers?.flatrate ?? []), ...(providers?.free ?? [])].map((p) => p.provider_name);
  item.metadata = {
    ...item.metadata,
    runtime: data.runtime || data.episode_run_time?.[0] || undefined,
    directors:
      media === "movie"
        ? (data.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name)
        : (data.created_by ?? []).map((c) => c.name),
    seasons: data.number_of_seasons || undefined,
    watchProviders: [...new Set(streaming)].slice(0, 6),
    watchLink: providers?.link,
  };
  return item;
};

export const tmdbCharacters = (data, media) => {
  const cast = media === "movie" ? data.credits?.cast ?? [] : data.aggregate_credits?.cast ?? [];
  return cast
    .slice(0, 12)
    .map((person) => {
      const character = media === "movie" ? person.character : person.roles?.[0]?.character;
      return character
        ? {
            kind: "character",
            externalId: `${media}:${data.id}:${person.id}`,
            name: character.split(" / ")[0].trim(),
            imageUrl: person.profile_path ? `${IMAGE}/w185${person.profile_path}` : null,
            role: `Joué par ${person.name}`,
          }
        : null;
    })
    .filter(Boolean);
};

export default {
  source: "tmdb",
  label: "TMDB",
  types: ["movie", "series"],
  configured: () => Boolean(process.env.TMDB_API_TOKEN || process.env.TMDB_API_KEY),
  async search(query, { type } = {}) {
    if (type === "movie" || type === "series") {
      const media = type === "movie" ? "movie" : "tv";
      const data = await request(`/search/${media}`, { query });
      return data.results.slice(0, 10).map((r) => tmdbToItem(r, media));
    }
    const data = await request("/search/multi", { query });
    return data.results.filter((r) => ["movie", "tv"].includes(r.media_type)).slice(0, 10).map((r) => tmdbToItem(r));
  },
  // Recherche d'un film précis pour les imports (titre + année)
  async match(title, { type = "movie", year } = {}) {
    const media = type === "series" ? "tv" : "movie";
    const data = await request(`/search/${media}`, {
      query: title,
      [media === "movie" ? "year" : "first_air_date_year"]: year || null,
    });
    return data.results.slice(0, 5).map((r) => tmdbToItem(r, media));
  },
  async fetchItem(externalId) {
    const ref = parseTmdbId(externalId);
    if (!ref) return null;
    const append = ref.media === "movie" ? "credits,watch/providers" : "aggregate_credits,watch/providers";
    const data = await request(`/${ref.media}/${ref.id}`, { append_to_response: append });
    return tmdbDetails(data, ref.media);
  },
  async fetchEntities(externalId) {
    const ref = parseTmdbId(externalId);
    if (!ref) return [];
    const append = ref.media === "movie" ? "credits" : "aggregate_credits";
    const data = await request(`/${ref.media}/${ref.id}`, { append_to_response: append });
    return tmdbCharacters(data, ref.media);
  },
  async similar(item) {
    const ref = parseTmdbId(item.externalId);
    if (!ref) return [];
    const data = await request(`/${ref.media}/${ref.id}/recommendations`);
    return data.results.slice(0, 12).map((r) => tmdbToItem(r, ref.media));
  },
  async trending(type = "movie") {
    const media = type === "series" ? "tv" : "movie";
    const data = await request(`/trending/${media}/week`);
    return data.results.slice(0, 12).map((r) => tmdbToItem(r, media));
  },
  yearOf,
};

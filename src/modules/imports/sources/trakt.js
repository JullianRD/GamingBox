"use strict";

import { fetchJson } from "../../catalog/http.js";
import { AppError } from "../../../utils/AppError.js";

/**
 * Trakt : historique public d'un compte (TRAKT_CLIENT_ID).
 * Chaque œuvre porte son id TMDB : pas de recherche par titre.
 */

const API = "https://api.trakt.tv";

const call = (path) =>
  fetchJson("Trakt", `${API}${path}`, {
    headers: { "trakt-api-version": "2", "trakt-api-key": process.env.TRAKT_CLIENT_ID, "Content-Type": "application/json" },
  });

const rowOf = (media, kind, extra) => ({
  type: kind === "movie" ? "movie" : "series",
  title: media.title,
  year: media.year ?? null,
  status: "completed",
  rating: null,
  review: null,
  favorite: false,
  tags: [],
  ids: { tmdb: media.ids?.tmdb ? `${kind === "movie" ? "movie" : "tv"}:${media.ids.tmdb}` : undefined },
  ...extra,
});

export const traktRows = ({ movies = [], shows = [], ratings = [], watchlist = [] }) => {
  const rows = new Map();
  const put = (media, kind, extra) => {
    if (!media?.title) return;
    const key = `${kind}:${media.ids?.trakt ?? media.title}`;
    rows.set(key, { ...(rows.get(key) ?? rowOf(media, kind, {})), ...extra });
  };
  for (const w of watchlist) put(w.movie ?? w.show, w.movie ? "movie" : "show", { status: "planned" });
  for (const m of movies) put(m.movie, "movie", { status: "completed", finishedAt: m.last_watched_at?.slice(0, 10) ?? null });
  for (const s of shows) {
    const aired = s.show?.aired_episodes;
    const seen = (s.seasons ?? []).reduce((n, season) => n + (season.episodes?.length ?? 0), 0);
    put(s.show, "show", { status: aired && seen < aired ? "in_progress" : "completed" });
  }
  for (const r of ratings) {
    const media = r.movie ?? r.show;
    if (media) put(media, r.movie ? "movie" : "show", { rating: r.rating || null });
  }
  return [...rows.values()];
};

export default {
  key: "trakt",
  label: "Trakt",
  types: ["movie", "series"],
  input: "username",
  placeholder: "Nom d'utilisateur Trakt",
  hint: "Le profil Trakt doit être public. Films, séries, notes et watchlist.",
  configured: () => Boolean(process.env.TRAKT_CLIENT_ID),
  async read({ username }) {
    const user = encodeURIComponent(String(username ?? "").trim());
    if (!user) throw new AppError("Indique un nom d'utilisateur Trakt.", 400);
    const [movies, shows, ratings, watchlist] = await Promise.all([
      call(`/users/${user}/watched/movies`),
      call(`/users/${user}/watched/shows?extended=full`),
      call(`/users/${user}/ratings`),
      call(`/users/${user}/watchlist`),
    ]);
    return { label: username, rows: traktRows({ movies, shows, ratings, watchlist }) };
  },
};

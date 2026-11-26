"use strict";

import { fetchJson } from "../../catalog/http.js";
import { AppError } from "../../../utils/AppError.js";

/**
 * Last.fm : albums les plus écoutés d'un compte (LASTFM_API_KEY).
 * Correspondance chez Deezer par album et artiste.
 */

export const lastfmRows = (albums, { favorites = 10 } = {}) =>
  albums
    .filter((a) => a.name && a.artist?.name)
    .map((a, index) => ({
      type: "music",
      title: a.name,
      year: null,
      creator: a.artist.name,
      status: "completed",
      rating: null,
      review: null,
      favorite: index < favorites,
      tags: [],
      playcount: Number(a.playcount) || 0,
      ids: {},
    }));

export default {
  key: "lastfm",
  label: "Last.fm",
  types: ["music"],
  input: "username",
  placeholder: "Nom d'utilisateur Last.fm",
  hint: "Récupère tes 200 albums les plus écoutés. Les 10 premiers deviennent favoris.",
  configured: () => Boolean(process.env.LASTFM_API_KEY),
  async read({ username }) {
    const user = String(username ?? "").trim();
    if (!user) throw new AppError("Indique un nom d'utilisateur Last.fm.", 400);
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    for (const [k, v] of Object.entries({ method: "user.gettopalbums", user, api_key: process.env.LASTFM_API_KEY, format: "json", limit: 200, period: "overall" }))
      url.searchParams.set(k, v);
    const data = await fetchJson("Last.fm", url);
    if (data.error) throw new AppError(`Last.fm : ${data.message}`, 400);
    return { label: user, rows: lastfmRows(data.topalbums?.album ?? []) };
  },
};

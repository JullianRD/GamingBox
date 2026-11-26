"use strict";

import { fetchJson } from "../../catalog/http.js";
import { getProvider } from "../../catalog/providers/index.js";
import { AppError } from "../../../utils/AppError.js";

/**
 * Steam : bibliothèque d'un profil public (Web API, STEAM_API_KEY).
 * Correspondance par id Steam chez IGDB, puis par titre.
 */

const API = "https://api.steampowered.com";

// Accepte un SteamID64, une URL de profil ou un pseudo personnalisé
export const parseSteamProfile = (input) => {
  const value = String(input ?? "").trim().replace(/\/+$/, "");
  const id = value.match(/(?:profiles\/)?(\d{17})$/);
  if (id) return { steamId: id[1] };
  const vanity = value.match(/(?:id\/)?([A-Za-z0-9_-]{2,32})$/);
  return vanity ? { vanity: vanity[1] } : null;
};

export const steamRows = (games, { playedStatus = "in_progress" } = {}) =>
  games
    .filter((g) => g.name)
    .map((g) => ({
      type: "game",
      title: g.name,
      year: null,
      status: g.playtime_forever > 0 ? playedStatus : "planned",
      rating: null,
      review: null,
      favorite: false,
      tags: [],
      playtime: g.playtime_forever || 0,
      ids: { steam: String(g.appid) },
    }));

const call = (path, params) => {
  const url = new URL(`${API}${path}`);
  url.searchParams.set("key", process.env.STEAM_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetchJson("Steam", url);
};

export default {
  key: "steam",
  label: "Steam",
  types: ["game"],
  input: "username",
  placeholder: "Pseudo, URL de profil ou SteamID",
  hint: "Ton profil et les détails de tes jeux doivent être publics (Steam, Confidentialité).",
  options: [
    { name: "playedStatus", label: "Jeux déjà lancés", choices: [["in_progress", "En cours"], ["completed", "Terminés"]] },
  ],
  configured: () => Boolean(process.env.STEAM_API_KEY),
  async read({ username, options = {} }) {
    const profile = parseSteamProfile(username);
    if (!profile) throw new AppError("Profil Steam non reconnu.", 400);
    let steamId = profile.steamId;
    if (!steamId) {
      const data = await call("/ISteamUser/ResolveVanityURL/v1/", { vanityurl: profile.vanity });
      steamId = data.response?.steamid;
      if (!steamId) throw new AppError("Profil Steam introuvable.", 404);
    }
    const data = await call("/IPlayerService/GetOwnedGames/v1/", {
      steamid: steamId,
      include_appinfo: 1,
      include_played_free_games: 1,
    });
    const games = data.response?.games;
    if (!games?.length) throw new AppError("Aucun jeu visible : vérifie que les détails de jeu du profil sont publics.", 400);
    return { label: username, rows: steamRows(games, options) };
  },
  async matchBatch(rows) {
    const igdb = getProvider("igdb");
    if (!igdb.configured()) return rows.map(() => null);
    const found = new Map();
    for (let i = 0; i < rows.length; i += 400) {
      for (const [id, item] of await igdb.findBySteamIds(rows.slice(i, i + 400).map((r) => r.ids.steam))) found.set(id, item);
    }
    return rows.map((r) => found.get(r.ids.steam) ?? null);
  },
};

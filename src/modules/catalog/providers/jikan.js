"use strict";

import { fetchJson, createThrottle } from "../http.js";

/**
 * Openings et endings d'un anime : Jikan (API non officielle de MyAnimeList, sans clé).
 * Jikan limite le débit (environ 3 requêtes par seconde) : appels espacés.
 */

const throttle = createThrottle(400);

// « 1: "Guren no Yumiya (紅蓮の弓矢)" by Linked Horizon (eps 1-13) » -> { title, artist, episodes }
export const parseTheme = (text) => {
  const match = String(text).match(/^(?:#?\d+:\s*)?"(.+?)"\s*(?:by\s+(.+?))?\s*(?:\((eps?[^)]*)\))?\s*$/i);
  if (!match) return { title: String(text).trim(), artist: null, episodes: null };
  return { title: match[1].trim(), artist: match[2]?.trim() || null, episodes: match[3]?.trim() || null };
};

export const themesToEntities = (malId, themes) => {
  const build = (list, prefix, label) =>
    (list ?? []).map((text, index) => {
      const theme = parseTheme(text);
      return {
        kind: "song",
        source: "jikan",
        externalId: `${malId}:${prefix}:${index + 1}`,
        name: theme.artist ? `${theme.title} — ${theme.artist}` : theme.title,
        imageUrl: null,
        role: `${label} ${index + 1}`,
        metadata: theme,
      };
    });
  return [...build(themes.openings, "op", "Opening"), ...build(themes.endings, "ed", "Ending")];
};

export const fetchAnimeThemes = async (malId) => {
  const data = await throttle(() => fetchJson("Jikan", `https://api.jikan.moe/v4/anime/${Number(malId)}/themes`));
  return themesToEntities(malId, data.data ?? {});
};

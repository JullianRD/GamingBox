"use strict";

import { logger } from "../config/logger.js";
import { acquire, pause, retryAfterMs } from "../modules/catalog/rateLimit.js";

/**
 * Service IGDB
 *
 * Gère :
 * - la récupération du token Twitch
 * - la recherche de jeux sur IGDB
 * - la récupération d'un jeu précis par son igdb_id
 */
class IgdbService {
  static #accessToken = null;
  static #tokenExpiresAt = 0;

  // Récupère un token OAuth Twitch pour appeler IGDB
  static async getAccessToken() {
    const now = Date.now();

    if (this.#accessToken && now < this.#tokenExpiresAt) {
      return this.#accessToken;
    }

    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Configuration IGDB manquante dans le fichier .env");
    }

    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Impossible de récupérer le token IGDB : ${errorText}`);
    }

    const data = await response.json();

    this.#accessToken = data.access_token;
    this.#tokenExpiresAt = now + (data.expires_in - 60) * 1000;

    logger.debug("IGDB : token récupéré");

    return this.#accessToken;
  }

  // Appel générique à l'API IGDB
  static async request(endpoint, body) {
    await acquire("IGDB");
    const token = await this.getAccessToken();
    const clientId = process.env.IGDB_CLIENT_ID;

    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "text/plain",
      },
      body,
    });

    if (response.status === 429) {
      pause("IGDB", retryAfterMs(response.headers.get("retry-after")));
      throw new Error("Erreur IGDB : quota atteint pour le moment");
    }

    const rawText = await response.text();

    logger.debug({ endpoint, status: response.status }, "IGDB : requête terminée");

    if (!response.ok) {
      throw new Error(`Erreur IGDB : ${rawText}`);
    }

    return rawText ? JSON.parse(rawText) : [];
  }

  // Convertit un jeu IGDB brut au format utilisé par l'application
  static mapGame(game) {
    return {
      igdbId: game.id,
      gameTitle: game.name,
      gameGenre: game.genres?.[0]?.name || "Inconnu",
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      thumbnailUrl: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null,
    };
  }

  // Convertit un personnage IGDB en entité Cocon
  static mapCharacter(character) {
    return {
      kind: "character",
      externalId: String(character.id),
      name: character.name,
      imageUrl: character.mug_shot?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${character.mug_shot.image_id}.jpg`
        : null,
    };
  }

  // Personnages d'un jeu (pour les favoris)
  static async findCharactersByGame(igdbId, limit = 24) {
    const body = `
      fields id,name,mug_shot.image_id;
      where games = (${Number(igdbId)});
      limit ${Number(limit)};
    `;

    const results = await this.request("characters", body);
    return results.map((character) => this.mapCharacter(character));
  }

  // Recherche des jeux sur IGDB
  static async searchGames(query) {
    const safeQuery = String(query || "").trim().replace(/"/g, '\\"');

    if (!safeQuery || safeQuery.length < 2) {
      return [];
    }

    const body = `
      search "${safeQuery}";
      fields id,name,first_release_date,genres.name,cover.image_id,version_parent;
      where version_parent = null;
      limit 10;
    `;

    const results = await this.request("games", body);

    return results.map((game) => this.mapGame(game));
  }

  // Jeux similaires (recommandations)
  static async findSimilarGames(igdbId) {
    const body = `
      fields similar_games.id,similar_games.name,similar_games.first_release_date,similar_games.genres.name,similar_games.cover.image_id;
      where id = ${Number(igdbId)};
      limit 1;
    `;
    const [game] = await this.request("games", body);
    return (game?.similar_games ?? []).map((similar) => this.mapGame(similar));
  }

  // Jeux récents les mieux notés (tendances)
  static async findTrendingGames(limit = 12) {
    const since = Math.floor(Date.now() / 1000) - 365 * 24 * 3600;
    const body = `
      fields id,name,first_release_date,genres.name,cover.image_id;
      where first_release_date > ${since} & total_rating_count > 20 & version_parent = null;
      sort total_rating_count desc;
      limit ${Number(limit)};
    `;
    return (await this.request("games", body)).map((game) => this.mapGame(game));
  }

  // Correspondance d'identifiants Steam (appid) vers les jeux IGDB
  static async findGamesBySteamIds(appIds) {
    if (!appIds.length) return new Map();
    const uids = appIds.map((id) => `"${Number(id)}"`).join(",");
    const body = `
      fields uid,game.id,game.name,game.first_release_date,game.genres.name,game.cover.image_id;
      where external_game_source = 1 & uid = (${uids});
      limit 500;
    `;
    const results = await this.request("external_games", body);
    return new Map(results.filter((row) => row.game?.id).map((row) => [String(row.uid), this.mapGame(row.game)]));
  }

  // Récupérer un jeu précis par son ID IGDB
  static async findGameByIgdbId(igdbId) {
    const body = `
      fields id,name,first_release_date,genres.name,cover.image_id,version_parent;
      where id = ${Number(igdbId)};
      limit 1;
    `;

    const results = await this.request("games", body);
    const game = results[0];

    if (!game) {
      return null;
    }

    return this.mapGame(game);
  }
}

export default IgdbService;
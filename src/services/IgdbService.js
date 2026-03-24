"use strict";

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

    return this.#accessToken;
  }

  // Appel générique à l'API IGDB
  static async request(endpoint, body) {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur IGDB : ${errorText}`);
    }

    return response.json();
  }

  // Recherche des jeux sur IGDB
  static async searchGames(query) {
    const safeQuery = String(query || "").trim().replace(/"/g, '\\"');

    if (!safeQuery || safeQuery.length < 2) {
      return [];
    }

    const body = `
      search "${safeQuery}";
      fields
        id,
        name,
        first_release_date,
        genres.name,
        cover.image_id,
        category,
        version_parent;
      where category = 0 & version_parent = null;
      limit 10;
    `;

    const results = await this.request("games", body);

    return results.map((game) => ({
      igdbId: game.id,
      gameTitle: game.name,
      gameGenre: game.genres?.[0]?.name || "Inconnu",
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      thumbnailUrl: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null,
    }));
  }

  // Récupérer un jeu précis par son ID IGDB
  static async findGameByIgdbId(igdbId) {
    const body = `
      fields
        id,
        name,
        first_release_date,
        genres.name,
        cover.image_id,
        category,
        version_parent;
      where id = ${Number(igdbId)} & category = 0;
      limit 1;
    `;

    const results = await this.request("games", body);
    const game = results[0];

    if (!game) {
      return null;
    }

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
}

export default IgdbService;
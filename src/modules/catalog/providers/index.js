"use strict";

import IgdbService from "../../../services/IgdbService.js";

/**
 * Fournisseurs de catalogue : chaque source sait récupérer une œuvre et,
 * si elle le peut, ses personnages. Les sections suivantes (TMDB, AniList,
 * Open Library...) s'ajoutent ici sans toucher au reste.
 *
 * Format d'une œuvre : { type, source, externalId, title, releaseDate,
 * coverUrl, genres, metadata }
 */

export const igdbToItem = (game) => ({
  type: "game",
  source: "igdb",
  externalId: String(game.igdbId),
  title: game.gameTitle,
  releaseDate: game.releaseDate,
  coverUrl: game.thumbnailUrl,
  genres: game.gameGenre && game.gameGenre !== "Inconnu" ? [game.gameGenre] : [],
  metadata: {},
});

const providers = {
  igdb: {
    type: "game",
    async fetchItem(externalId) {
      const game = await IgdbService.findGameByIgdbId(externalId);
      return game ? igdbToItem(game) : null;
    },
    async fetchCharacters(externalId) {
      return IgdbService.findCharactersByGame(externalId);
    },
  },
};

export const getProvider = (source) => providers[source] ?? null;

"use strict";

import IgdbService from "../../../services/IgdbService.js";

// Jeux vidéo : IGDB (Twitch)
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

export default {
  source: "igdb",
  label: "IGDB",
  types: ["game"],
  configured: () => Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET),
  async search(query) {
    return (await IgdbService.searchGames(query)).map(igdbToItem);
  },
  async fetchItem(externalId) {
    const game = await IgdbService.findGameByIgdbId(externalId);
    return game ? igdbToItem(game) : null;
  },
  async fetchEntities(externalId) {
    return IgdbService.findCharactersByGame(externalId);
  },
  async similar(item) {
    return (await IgdbService.findSimilarGames(item.externalId)).map(igdbToItem);
  },
  async trending() {
    return (await IgdbService.findTrendingGames()).map(igdbToItem);
  },
  async findBySteamIds(appIds) {
    const games = await IgdbService.findGamesBySteamIds(appIds);
    return new Map([...games].map(([appId, game]) => [appId, igdbToItem(game)]));
  },
};

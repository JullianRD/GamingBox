"use strict";
/**
 * Service métier jeux
 */
import GameRepository from "../repositories/PgGameRepository.js";
import IgdbService from "./IgdbService.js";

class GameService {
  // Trouver tout les jeux présent en base
  static async findAllByGameId() {
    const games = await GameRepository.findAllByGameId();
    return games || [];
  }

  // Trouver un jeu spécifique
  static async findById(gameId) {
    return GameRepository.findById(gameId);
  }

  // Trouver un jeu local via igdb_id
  static async findByIgdbId(igdbId) {
    return GameRepository.findByIgdbId(igdbId);
  }

  // Trouver toutes les reviews associé à un jeu
  static async getGameWithReviews(gameId) {
    const game = await GameRepository.findById(gameId);

    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    const reviews = await GameRepository.findReviewsByGameId(gameId);
    return { game, reviews };
  }

  // Recherche sur IGDB
  static async searchIgdbGames(query) {
    return IgdbService.searchGames(query);
  }

  // Importer un jeu depuis IGDB s'il n'existe pas déjà en local
  static async getOrCreateByIgdbId(igdbId) {
    const existingGame = await GameRepository.findByIgdbId(igdbId);

    if (existingGame) {
      return existingGame;
    }

    const igdbGame = await IgdbService.findGameByIgdbId(igdbId);

    if (!igdbGame) {
      throw new Error("Jeu introuvable sur IGDB.");
    }

    return GameRepository.create(igdbGame);
  }

  // Créer un jeu en base local
  static async create(gameData) {
    return GameRepository.create(gameData);
  }

  // Mis à jour d'un jeu
  static async update(gameId, data) {
    return GameRepository.update(gameId, data);
  }

  // Suppression d'un jeu
  static async delete(gameId) {
    return GameRepository.delete(gameId);
  }
}

export default GameService;
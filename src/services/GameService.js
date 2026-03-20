"use strict";
/**
 * Service métier reviews
 *
 */
import GameRepository from "../repositories/PgGameRepository.js";

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

  // Trouver toutes les reviews associé à un jeu
  static async getGameWithReviews(gameId) {
    const game = await GameRepository.findById(gameId)

    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    const reviews = await GameRepository.findReviewsByGameId(gameId);
    return { game, reviews };
  }

  // Créer un jeu en base local
  static async create(gameId) {
  return GameRepository.create(gameId)
  }

  // Mis à jour d'un jeu
  static async update(gameId) {
    return GameRepository.update(gameId);
  }

  // Suppression d'un jeu
  static async delete(gameId) {
    return GameRepository.delete(gameId);
  }
}

export default GameService;

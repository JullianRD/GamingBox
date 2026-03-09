"use strict";
/**
 * Service métier reviews
 *
 */
import GameRepository from "../repositories/PgGameRepository.js";

class GameService {
  // Trouver tout les jeux présent en base
  static async findAllByGameId(gameId) {
    return GameRepository.findAllByGameId(gameId);
  }

  // Trouver un jeu spécifique
  static async findById(gameId) {
    return GameRepository.findById(gameId);
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

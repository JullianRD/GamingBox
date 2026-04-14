"use strict";

import UserRepository from "../repositories/PgUserRepository.js";
import ReviewRepository from "../repositories/PgReviewRepository.js";
import TagRepository from "../repositories/PgTagRepository.js";
import ShareRepository from "../repositories/PgShareRepository.js";
import GameRepository from "../repositories/PgGameRepository.js";

/**
 * AdminService
 *
 * Centralise les actions d'administration :
 * - lecture globale des ressources
 * - suppression globale des ressources
 */
class AdminService {
  // Dashboard admin
  static async getDashboardData() {
    const [users, reviews, tags, shares, games] = await Promise.all([
      UserRepository.findAllAdmin(),
      ReviewRepository.findAllAdmin(),
      TagRepository.findAllAdmin(),
      ShareRepository.findAllAdmin(),
      GameRepository.findAllByGameId(),
    ]);

    return {
      counts: {
        users: users.length,
        reviews: reviews.length,
        tags: tags.length,
        shares: shares.length,
        games: games.length,
      },
    };
  }

  // Liste des utilisateurs
  static async getAllUsers() {
    return UserRepository.findAllAdmin();
  }

  // Liste des reviews
  static async getAllReviews() {
    return ReviewRepository.findAllAdmin();
  }

  // Liste des tags
  static async getAllTags() {
    return TagRepository.findAllAdmin();
  }

  // Liste des partages
  static async getAllShares() {
    return ShareRepository.findAllAdmin();
  }

  // Liste des jeux
  static async getAllGames() {
    return GameRepository.findAllByGameId();
  }

  // Suppression utilisateur
  static async deleteUser(userId) {
    return UserRepository.delete(userId);
  }

  // Suppression review
  static async deleteReview(reviewId) {
    return ReviewRepository.delete(reviewId);
  }

  // Suppression tag
  static async deleteTag(tagId) {
    return TagRepository.delete(tagId);
  }

  // Suppression partage
  static async deleteShare(shareId) {
    return ShareRepository.delete(shareId);
  }

  // Suppression jeu
  static async deleteGame(gameId) {
    return GameRepository.delete(gameId);
  }
}

export default AdminService;
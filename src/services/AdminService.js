"use strict";

import db from "../config/database.js";
import { AppError } from "../utils/AppError.js";
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
  // Dashboard admin : une seule requête de comptage (pas de chargement des tables entières)
  static async getDashboardData() {
    const { rows } = await db.query(/*sql*/ `
      SELECT
        (SELECT COUNT(*) FROM users)::int   AS users,
        (SELECT COUNT(*) FROM reviews)::int AS reviews,
        (SELECT COUNT(*) FROM tags)::int    AS tags,
        (SELECT COUNT(*) FROM shares)::int  AS shares,
        (SELECT COUNT(*) FROM games)::int   AS games`);
    return { counts: rows[0] };
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
  static async deleteUser(userId, actorId) {
    if (userId === actorId) {
      throw AppError.badRequest("Tu ne peux pas supprimer ton propre compte depuis l'administration.");
    }

    const target = await UserRepository.findById(userId);
    if (!target) throw AppError.notFound("Utilisateur introuvable.");

    // Toujours conserver au moins un administrateur
    if (["admin", "super_admin"].includes(target.roleName)) {
      const { rows } = await db.query(
        "SELECT COUNT(*)::int AS total FROM users WHERE role_name IN ('admin', 'super_admin')",
      );
      if (rows[0].total <= 1) {
        throw AppError.badRequest("Impossible de supprimer le dernier administrateur.");
      }
    }

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
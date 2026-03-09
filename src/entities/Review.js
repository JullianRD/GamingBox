"use strict";
/**
 * @fileoverview Modèle de données pour les Reviews
 *
 * 🎯 RÔLE DU MODÈLE : (Pour le MVC avec modals)
 * Le modèle est la SEULE couche qui communique avec la base de données.
 * Il encapsule toutes les requêtes SQL et transforme les résultats en objets JavaScript.
 */

/**
 * @class Review
 * @description Représente une "Pépite" (élément de connaissance) dans l'application
 */
class Review {
  constructor(data) {
    this.id = data.id_review;
    this.userId = data.user_id;
    this.gameId = data.game_id;
    this.reviewTitle = data.review_title;
    this.gameTitle = data.game_title;
    this.slug = data.slug;
    this.releaseDate = data.release_date;
    this.gameGenre = data.game_genre;
    this.thumbnailUrl = data.thumbnail_url;
    this.metadata = data.metadata;
    this.reviewRate = data.review_rate;
    this.reviewLike = data.review_like;
    this.reviewPlatine = data.review_platine;
    this.progressionStatus = data.progression_status;
    this.avisReview = data.avis_review;
    this.gamePlatforme = data.game_platforme;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * Crée une entité depuis une ligne PostgreSQL
   */
  static fromDatabase(row) {
    return row ? new review(row) : null;
  }

  /**
   * Crée une liste d'entités depuis des lignes PostgreSQL
   */
  static fromDatabaseList(rows) {
    return rows.map((row) => new Review(row));
  }

  /**
   * Filtre les données sensibles pour l'exposition en API
   * @returns {object} - Objet review sans données sensibles
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      gameId: this.gameId,
      reviewTitle: this.reviewTitle,
      gameTitle: this.gameTitle,
      slug: this.slug,
      releaseDate: this.releaseDate,
      gameGenre: this.gameGenre,
      thumbnailUrl: this.thumbnailUrl,
      metadata: this.metadata,
      reviewRate: this.reviewRate,
      reviewLike: this.reviewLike,
      reviewPlatine: this.reviewPlatine,
      progressionStatus: this.progressionStatus,
      avisReview: this.avisReview,
      gamePlatforme: this.gamePlatforme,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convertit l'objet review en chaîne de caractères JSON
   * @returns {string} - Chaîne de caractères JSON représentant l'objet review
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export default Review;

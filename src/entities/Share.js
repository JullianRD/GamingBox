"use strict";
/**
 * @fileoverview Modèle Share - Gestion des partages de ressources
 * @module models/Share
 */

class Share {
  constructor(data) {
    // Mapping SQL (snake_case) vers JS (camelCase)
    this.id = data.id_share;
    this.userId = data.user_id;
    this.reviewId = data.review_id;
    this.recipientEmail = data.recipient_email;
    this.shareToken = data.share_token;
    this.accessConfig = data.access_config || {};
    this.createdAt = data.created_at || data.share_created_at;
    this.updatedAt = data.updated_at;

    // Type de partage
    this.shareType = data.share_type || (data.review_id ? "review" : "profile");

    // Relation avec Review et User (si JOIN effectué)
    if (data.owner_pseudo || data.user_pseudo) {
      this.user = {
        id: data.owner_id || data.user_id,
        pseudo: data.user_pseudo || data.owner_pseudo,
        avatar: data.user_avatar || data.owner_avatar,
      };
    }

    if (data.review_title) {
      this.review = {
        id: data.id_review || data.review_id,
        reviewTitle: data.review_title,
        slug: data.slug,
        reviewRate: data.review_rate,
        progressionStatus: data.progression_status,
        gameTitle: data.game_title,
        thumbnailUrl: data.thumbnail_url,
        avisReview: data.avis_review,
        gamePlatforme: data.game_platforme,
        reviewLike: data.review_like,
        reviewPlatine: data.review_platine,
        releaseDate: data.release_date,
        gameGenre: data.game_genre,
        createdAt: data.review_created_at,
        updatedAt: data.review_updated_at,
      };
    }

    // Profil partagé
    if (this.shareType === "profile") {
      this.profile = {
        id: data.owner_id || data.user_id,
        pseudo: data.owner_pseudo || data.user_pseudo || null,
        avatar: data.owner_avatar || data.user_avatar || null,
        biographie: data.owner_biographie || null,
      };
    }
  }

  /**
   * Crée une entité depuis une ligne PostgreSQL
   */
  static fromDatabase(row) {
    return row ? new Share(row) : null;
  }

  /**
   * Crée une liste d'entités depuis des lignes PostgreSQL
   */
  static fromDatabaseList(rows) {
    return rows.map((row) => new Share(row));
  }

  /**
   * Filtre les données sensibles pour l'exposition en API
   * @returns {object} - Objet Share sans données sensibles
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      reviewId: this.reviewId,
      recipientEmail: this.recipientEmail,
      shareToken: this.shareToken,
      accessConfig: this.accessConfig,
      shareType: this.shareType,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...(this.user && { user: this.user }),
      ...(this.review && { review: this.review }),
      ...(this.profile && { profile: this.profile }),
    };
  }

  /**
   * Convertit l'objet Share en chaîne de caractères JSON
   * @returns {string} - Chaîne de caractères JSON représentant l'objet Share
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export default Share;
"use strict";
/**
 * @fileoverview Modèle Share - Gestion des partages de pépites
 * @module models/Share
 */

 class Share {
  constructor(data) {
    // Mapping SQL (snake_case) vers JS (camelCase)
    this.id = data.id_share;
    this.userId = data.user_id
    this.reviewId = data.review_id;
    this.recipientEmail = data.recipient_email;
    this.shareToken = data.share_token;
    this.accessConfig = data.access_config;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;

    //Relation avec Review et User (si JOIN effectué)
    if (data.user_pseudo) {
      this.user = {
        id: data.user_id,
        pseudo: data.user_pseudo,
        roleName: data.user_role_name
      };
    }
    if (data.review_title) {
        this.review = {
            id: data.review_id,
            reviewTitle: data.review_review_title,
            gameTitle: data.review_game_title
        }
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...(this.item && { item: this.item }),
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

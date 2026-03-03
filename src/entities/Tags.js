"use strict";
/**
 * @fileoverview Modèle Tag - Gestion des catégories/taxonomie utilisateur
 * @module models/Tag
 */

 class Tag {
  constructor(data) {
    // Mapping SQL (snake_case) vers JS (camelCase)
    this.id = data.id_tag;
    this.tagName = data.tag_name;
    this.userId = data.user_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;

    // Relation avec User (si JOIN effectué)
    if (data.user_pseudo) {
      this.user = {
        id: data.user_id,
        pseudo: data.user_pseudo,
        email: data.user_email,
      };
    }

    // Compteur d'items (si agrégation effectuée)
    if (data.item_count !== undefined) {
      this.reviewCount = parseInt(data.review_count, 10);
    }
  }

  /**
   * Crée une entité depuis une ligne PostgreSQL
   */
  static fromDatabase(row) {
    return row ? new Tag(row) : null;
  }

  /**
   * Crée une liste d'entités depuis des lignes PostgreSQL
   */
  static fromDatabaseList(rows) {
    return rows.map((row) => new Tag(row));
  }

  /**
   * Filtre les données sensibles pour l'exposition en API
   * @returns {object} - Objet Tag sans données sensibles
   */
  toJSON() {
    return {
      id: this.id,
      tagName: this.tagName,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...(this.reviewCount !== undefined && { reviewCount: this.reviewCount }),
    };
  }

  /**
   * Convertit l'objet Tag en chaîne de caractères JSON
   * @returns {string} - Chaîne de caractères JSON représentant l'objet Tag
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export default Tag;

"use strict";
/**
 * @fileoverview Modèle User - Gestion des utilisateurs et authentification
 * @module models/User
 * @security Contient des données sensibles (password_hash) - Utiliser toJSON() ou DTO
 */

class User {
  constructor(data) {
    // Mapping SQL (snake_case) vers JS (camelCase)
    this.id = data.id_user;
    this.email = data.email;
    this.passwordHash = data.password_hash; // ⚠️ SENSIBLE - Ne jamais exposer en API
    this.pseudo = data.pseudo;
    this.biographie = data.biographie;
    this.roleName = data.role_name;
    this.authProvider = data.auth_provider;
    this.settingsUser = data.settings_user;
    this.gdprConsent = data.gdpr_consent;
    this.gdprConsentDate = data.gdpr_consent_date;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;

    // Statistiques (si agrégation effectuée)
    if (data.reviews_count !== undefined) {
      this.itemsCount = parseInt(data.reviews_count, 10);
    }
    if (data.tags_count !== undefined) {
      this.tagsCount = parseInt(data.tags_count, 10);
    }
  }

  /**
   * Crée une entité depuis une ligne PostgreSQL
   */
  static fromDatabase(row) {
    return row ? new User(row) : null;
  }

  /**
   * Crée une liste d'entités depuis des lignes PostgreSQL
   */
  static fromDatabaseList(rows) {
    return rows.map((row) => new User(row));
  }

  /**
   * Filtre les données sensibles pour l'exposition en API
   * @returns {object} - Objet User sans données sensibles
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      pseudo: this.pseudo,
      biographie: this.biographie,
      roleName: this.roleName,
      authProvider: this.authProvider,
      settingsUser: this.settingsUser,
      gdprConsent: this.gdprConsent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // ❌ passwordHash exclu
      // ❌ gdprConsentDate exclu (donnée interne)
      ...(this.reviewsCount !== undefined && { reviewsCount: this.reviewsCount }),
      ...(this.tagsCount !== undefined && { tagsCount: this.tagsCount }),
    };
  }

  /**
   * Convertit l'objet User en chaîne de caractères JSON
   * @returns {string} - Chaîne de caractères JSON représentant l'objet User
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export default User;

"use strict";

import AppEventRepository from "../repositories/PgAppEventRepository.js";
import logger from "../config/logger.js";

/**
 * AppEventService : journalisation applicative (append-only).
 * Les catégories correspondent à l'enum SQL event_category_enum :
 * analytics | audit | monitoring | gdpr.
 *
 * L'émission ne doit jamais casser le parcours utilisateur : toute erreur
 * est loggée puis ignorée.
 */
class AppEventService {
  static async log({ userId = null, category = "analytics", type, severity = "info", message, metadata = {} }) {
    try {
      return await AppEventRepository.create({
        userId,
        eventCategory: category,
        eventType: type,
        severity,
        message,
        metadata,
      });
    } catch (err) {
      logger.error({ err, type }, "Impossible d'enregistrer l'événement applicatif");
      return null;
    }
  }

  static authSuccess(userId, metadata = {}) {
    return this.log({ userId, category: "audit", type: "user.login", message: "Connexion réussie", metadata });
  }

  static authFailure(metadata = {}) {
    // L'email n'est jamais stocké en clair : on garde l'IP et un indicateur
    return this.log({
      category: "audit",
      type: "user.login_failed",
      severity: "warning",
      message: "Échec de connexion",
      metadata,
    });
  }

  static userRegistered(userId) {
    return this.log({ userId, category: "analytics", type: "user.registered", message: "Compte créé" });
  }

  static reviewCreated(userId, reviewId) {
    return this.log({ userId, category: "analytics", type: "review.created", message: "Review créée", metadata: { reviewId } });
  }

  static shareCreated(userId, shareId) {
    return this.log({ userId, category: "audit", type: "share.created", message: "Ressource partagée", metadata: { shareId } });
  }

  static shareAccessed(shareId, metadata = {}) {
    return this.log({ category: "audit", type: "share.accessed", message: "Partage consulté", metadata: { shareId, ...metadata } });
  }

  static gdprExport(userId) {
    return this.log({ userId, category: "gdpr", type: "gdpr.export", message: "Export des données personnelles" });
  }

  static gdprDelete(userId) {
    return this.log({ category: "gdpr", type: "gdpr.account_deleted", message: "Suppression de compte", metadata: { userId } });
  }

  static adminAction(adminId, type, metadata = {}) {
    return this.log({ userId: adminId, category: "audit", type: `admin.${type}`, severity: "warning", message: "Action d'administration", metadata });
  }
}

export default AppEventService;

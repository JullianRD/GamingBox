"use strict";
import { logger } from "../config/logger.js";

/**
 * Helper pour standariser les logs d'événements applicatifs
 * @modules utils/logHelper
 */

/**
 * Log une action importante de l'utilisateur (Audit trail)
 * @param {string} action - Nom de l'action (ex: 'REVIEW_CREATE', 'AUTH_LOGIN')
 * @param {string} userId - L'id de l'utlisateur
 * @param {Object} details - Détails supplémentaires (ex: {itemId: a5d4z..., ip: '...' })
 */

export const logAppEvent = (action, userId, details = {}) => {
  logger.info(
    {
      type: "APP_EVENT", // Permet de filtrer facilement les logs
      action,
      userId,
      ...details,
    },
    `[${action}] User ${userId}`,
  );
};

/**
 * Log une erreur métier spécifique avec contexte
 * @param {Error} error - l'objet erreur
 * @param {string} contexMessage - Message décrivant le contexte
 * @param {Object} data - Données liées à l'erreur
 */

export const logAppError = (error, contexMessage = "", data = {}) => {
  logger.error(
    {
      type: "APP_ERROR",
      ...data,
      err: error, // Pino sérialise automatiquement l'objet error
    },
    contexMessage || error.message,
  );
};


// Ce fichier sert à :

// ✔ standardiser les logs
// ✔ tracer les actions utilisateur (audit trail)
// ✔ logguer les erreurs avec contexte
// ✔ rendre les logs filtrables et exploitables

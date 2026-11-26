"use strict";
/**
 * Erreur métier standardisée.
 * Distingue les erreurs prévues (400, 403, 404, 409, 422...) des bugs (500).
 * Le message d'une AppError est destiné à l'utilisateur.
 */
export class AppError extends Error {
  /**
   * @param {string} message Message affichable à l'utilisateur
   * @param {number} [statusCode=500]
   * @param {string} [code] Code machine stable (ex: "FORBIDDEN")
   */
  constructor(message, statusCode = 500, code = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = "Requête invalide.") {
    return new AppError(message, 400, "BAD_REQUEST");
  }

  static forbidden(message = "Accès interdit.") {
    return new AppError(message, 403, "FORBIDDEN");
  }

  static notFound(message = "Ressource introuvable.") {
    return new AppError(message, 404, "NOT_FOUND");
  }

  static conflict(message = "Conflit avec une ressource existante.") {
    return new AppError(message, 409, "CONFLICT");
  }
}

export default AppError;

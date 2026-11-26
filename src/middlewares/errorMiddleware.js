"use strict";
import logger from "../config/logger.js";
import { env } from "../config/env.js";

const wantsJson = (req) =>
  req.forceJson ||
  req.xhr ||
  req.is("application/json") ||
  (req.get("accept") || "").includes("application/json");

/**
 * 404 : doit être placé après toutes les routes.
 */
export const notFoundHandler = (req, res) => {
  logger.warn({ url: req.originalUrl, ip: req.ip }, "404 Page Not Found");

  if (wantsJson(req)) {
    return res.status(404).json({ error: "Ressource introuvable." });
  }

  res.status(404).render("pages/errors/404", {
    title: "Page non trouvée - GamingBox",
    requestedUrl: req.originalUrl,
  });
};

/**
 * Traduit une erreur en statut HTTP + message affichable.
 * - AppError : statut et message métier conservés
 * - erreur CSRF : 403
 * - erreur Multer / charge trop grosse : 400 / 413
 * - tout le reste : 500, message générique (jamais de détail technique en production)
 */
export function normalizeError(err) {
  if (err?.code === "EBADCSRFTOKEN") {
    return { status: 403, message: "Session expirée ou formulaire invalide. Rechargez la page.", expose: true };
  }
  if (err?.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return {
      status: tooBig ? 413 : 400,
      message: tooBig ? "Fichier trop volumineux (5 Mo maximum)." : "Envoi de fichier invalide.",
      expose: true,
    };
  }
  // Identifiant mal formé (ex: UUID invalide dans l'URL) : la ressource n'existe pas
  if (err?.code === "22P02") {
    return { status: 404, message: "Ressource introuvable.", expose: true };
  }
  if (err?.type === "entity.too.large") {
    return { status: 413, message: "Requête trop volumineuse.", expose: true };
  }
  if (err?.type === "entity.parse.failed") {
    return { status: 400, message: "Requête mal formée.", expose: true };
  }
  if (err?.isOperational && err.statusCode) {
    return { status: err.statusCode, message: err.message, expose: true };
  }
  return {
    status: 500,
    message: "Une erreur est survenue. Veuillez réessayer plus tard.",
    expose: false,
  };
}

/**
 * Handler global d'erreurs.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const { status, message, expose } = normalizeError(err);

  const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log({ err, url: req.originalUrl, method: req.method, reqId: req.id }, "Erreur de requête");

  if (wantsJson(req)) {
    return res.status(status).json({ error: message });
  }

  const view = [403, 404].includes(status) ? `pages/errors/${status}` : "pages/errors/500";

  res.status(status).render(view, {
    title: `Erreur ${status} - GamingBox`,
    status,
    message,
    // Détail technique uniquement en développement, jamais pour une erreur inattendue en prod
    stack: !env.isProduction && !expose ? err.stack : null,
    requestedUrl: req.originalUrl,
  });
};

"use strict";
import logger from "../config/logger.js";

/**
 * Middleware pour gérer les erreurs 404 (pages non trouvé)
 * Doit être placé après toutes les routes
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */

export const notFoundHandler = (req, res) => {
  logger.warn({ url: req.originalUrl, ip: req.ip }, "404 Page Not Found");

  res.status(404).render("pages/errors/404", {
    title: "Page non trouvée - Cocon",
    message: `La page "${req.originalUrl}" n'existe pas.`,
    requestedUrl: req.originalUrl,
  });
};

/**
 * Middleware global de gestions des erreurs (500)
 * Capture les exceptions lancées dans l'application.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

export const globalErrorHandler = (err, req, res, next) => {
  // Erreurs prévues (AppError 4xx, jeton CSRF invalide) : pas une panne serveur
  const status = err.statusCode || err.status;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    logger.warn({ url: req.originalUrl, status, message: err.message }, "Erreur client");
    if (status === 404) {
      return res.status(404).render("pages/errors/404", {
        title: "Page non trouvée - Cocon",
        message: err.message,
        requestedUrl: req.originalUrl,
      });
    }
    return res.status(status).send(err.message);
  }

  // On logue l'erreur technique complète pour les devs
  logger.error(
    {
      err: { message: err.message, stack: err.stack },
      url: req.originalUrl,
      method: req.method,
    },
    "Server Error 500",
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.status(500).render("pages/errors/500", {
    title: "Erreur serveur - Cocon",
    message: isProduction
      ? "Une erreur est survenue. Veuillez réessayer plus tard."
      : err.message,
    stack: isProduction ? null : err.stack,
  });
};

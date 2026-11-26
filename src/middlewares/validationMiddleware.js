"use strict";

import { ZodError } from "zod";
import { safeReferer } from "../utils/safeRedirect.js";

/** Champs qui ne doivent jamais être conservés en session ni loggés. */
const SENSITIVE_FIELDS = ["password", "passwordConfirm", "confirmPassword", "_csrf", "token"];

export const stripSensitive = (body) => {
  const clean = { ...(body || {}) };
  for (const field of SENSITIVE_FIELDS) delete clean[field];
  return clean;
};

/**
 * Middleware de validation basé sur Zod v4.
 * - succès : `req.body` est remplacé par les données nettoyées
 * - échec : erreurs par champ en session (flash) puis redirection vers la page précédente
 *
 * @param {import('zod').ZodType} schema
 * @param {{ fallback?: string }} [options] Cible si aucun Referer interne n'est disponible
 * @returns {import('express').RequestHandler}
 */
export const validate =
  (schema, { fallback = "/" } = {}) =>
  (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (!(error instanceof ZodError)) return next(error);

      const errors = {};
      for (const issue of error.issues) {
        const field = issue.path[0] ?? "global";
        if (!errors[field]) errors[field] = issue.message;
      }

      req.log?.warn({ fields: Object.keys(errors) }, "Validation échouée");

      req.session.flash = { error: "Veuillez corriger les erreurs ci-dessous." };
      req.session.errors = errors;
      // Jamais de mot de passe ni de jeton dans la session persistée en base
      req.session.oldInput = stripSensitive(req.body);

      return res.redirect(safeReferer(req, fallback));
    }
  };

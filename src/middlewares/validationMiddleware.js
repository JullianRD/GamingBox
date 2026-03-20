"use strict";

import { ZodError } from "zod";

/**
 * Middleware de validation basé sur Zod v4
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 *
 * @see https://zod.dev/
 */
export const validate = (schema) => (req, res, next) => {
  try {
    // ✅ parse valide et retourne les données nettoyées
    req.body = schema.parse(req.body);

    next();
  } catch (error) {
if (error instanceof ZodError) {
  const errors = {};

  console.log("=== VALIDATION ERROR ===");
  console.log("BODY RECEIVED:", req.body);
  console.log("ZOD ISSUES:", error.issues);

  for (const issue of error.issues) {
    const field = issue.path[0] || "global";
    errors[field] = issue.message;
  }

  req.session.flash = {
    error: "Veuillez corriger les erreurs ci-dessous.",
  };

  req.session.errors = errors;
  req.session.oldInput = req.body;

  return res.redirect(req.get("Referer") || "/");
}

    next(error); // Erreur technique
  }
};


// Ce fichier définit un middleware de validation des données entrantes avec Zod.
// Son rôle est de vérifier les données d’un formulaire avant que ton controller ne s’exécute.


// Ce middleware permet :

// ✔ valider les données utilisateur
// ✔ éviter les erreurs backend
// ✔ afficher les erreurs dans le formulaire
// ✔ préserver les champs saisis
// ✔ centraliser la validation

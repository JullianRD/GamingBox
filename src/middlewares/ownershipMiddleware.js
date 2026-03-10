"use strict";
import { AppError } from "../utils/AppError";

/**
 * Vérifie si l'utilisateur connecté est propriétaire de la resource.
 * @param {Object} repository - Le repository (ex: ReviewRepository)
 * @param {string} paramId - Le nom du paramètre dans l'URL (ex: 'id')
 */

export const ensureOwnership = (repository, paramId = "id") => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramId];
      const userId = req.session.userId; // Via authMiddleware

      const resource = await repository.findById(resourceId);

      if (!resource) {
        throw new AppError("Ressource introuvable", 404);
      }

      // Supposons que toutes les tables ont une colonne 'user_id'
      if (resource.user_id !== userId && req.session.role !== "admin") {
        throw new AppError(
          "Accès interdit: vous ne possédez pas cette pépite",
          403,
        );
      }

      // On attache la ressource à req pour éviter de la re-chercher dans le contrôle
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};



// Ce middleware d'autorisation :

// ✔ vérifie que la ressource existe
// ✔ vérifie que l’utilisateur est propriétaire
// ✔ autorise les admins
// ✔ évite les requêtes DB inutiles
// ✔ fonctionne pour plusieurs ressources

"use strict";

import { Router } from "express";
import ProfileController from "../../controller/ProfileController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";

const router = Router();

/**
 * Routes PROFIL utilisateur
 *
 * Pré-requis :
 * - utilisateur authentifié
 *
 * @see docs/user-stories.md#profile
 * @see docs/user-stories.md#rgpd
 */

// 🔐 Zone utilisateur connecté
router.use(requireAuth);

/**
 * 👤 Affichage du profil
 * GET /profile
 */
router.get("/profile", ProfileController.show);

// Affiche le formulaire d'édition du profil
router.get("/profile")

/**
 * 🔄 Mise à jour du profil
 * POST /profile
 */
router.post("/profile/;id/edit", ProfileController.edit);

/**
 * 🗑️ Suppression du compte
 * POST /profile/delete
 */
router.post("/profile/delete", ProfileController.destroy);

/**
 * 📦 Export RGPD
 * GET /profile/export
 */
router.get("/profile/export", ProfileController.export);

export default router;

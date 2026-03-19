"use strict";

import { Router } from "express";
import ProfileController from "../../controller/ProfileController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";

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
router.get("/profile", ProfileController.index);

// Affiche le formulaire d'édition du profil
router.get("/profile/edit", ProfileController.edit)

/**
 * 🔄 Mise à jour du profil
 * POST /profile
 */
router.post("/profile/edit", requireAuth, doubleCsrfProtection, ProfileController.update);

/**
 * 🗑️ Suppression du compte
 * POST /profile/delete
 */
router.post("/profile/delete", requireAuth, doubleCsrfProtection, ProfileController.destroy);

/**
 * 📦 Export RGPD
 * GET /profile/export
 */
router.get("/profile/export", ProfileController.export);

export default router;

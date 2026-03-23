"use strict";

import { Router } from "express";
import ShareController from "../../controller/ShareController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as shareSchemas } from "../../validators/shareValidator.js";

const router = Router();

/**
 * Routes SHARES
 *
 * - Gestion : utilisateur connecté
 * - Accès public : via token
 */

//
// 🌍 ROUTE PUBLIQUE (token)
//

/**
 * 🔓 Accès public à un partage
 * GET /shares/access/:token
 */
router.get("/shares/access/:token", ShareController.access);

//
// 🔐 ZONE UTILISATEUR CONNECTÉ
//
router.use(requireAuth);

/**
 * 📄 Liste des partages
 * GET /shares
 */
router.get("/shares", ShareController.index);

/**
 * ➕ Formulaire création pour un profil
 * GET /shares/new/profile
 */
router.get("/shares/new/profile", ShareController.newForProfile);

/**
 * ➕ Formulaire création pour une review
 * GET /shares/new/review
 */
router.get("/shares/new/review", ShareController.newForReview);

/**
 * 💾 Création pour un profil
 * POST /shares/profile
 */
router.post(
  "/shares/profile",
  validate(shareSchemas.createProfile),
  ShareController.storeForProfile,
);

/**
 * 💾 Création pour une review
 * POST /shares/review
 */
router.post(
  "/shares/review",
  validate(shareSchemas.createReview),
  ShareController.storeForReview,
);

/**
 * 🗑️ Révocation
 * POST /shares/:id/delete
 */
router.post("/shares/:id/delete", ShareController.destroy);

export default router;
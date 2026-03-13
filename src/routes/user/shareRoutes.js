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
 * GET /shares/new?itemId=xxx
 */
router.get("/shares/new", ShareController.newforProfil);

// Formulaire de création pour une review
router.get("/shares/new", ShareController.newForReview);

/**
 * 💾 Création pour un profil
 * POST /shares
 */
router.post("/shares", validate(shareSchemas.create), ShareController.storeForProfil);

// Création pour une review
router.post("/shares", validate(shareSchemas.create), ShareController.storeForReview);

/**
 * ✏️ Formulaire édition
 * GET /shares/:id/edit
 */
router.get("/shares/:id/edit", ShareController.edit);

/**
 * 🔄 Mise à jour pour un profil
 */
router.post("/shares/:id", validate(shareSchemas.create),ShareController.updateForProfil);

// Mise à jour pour une review
router.post("/shares/:id", validate(shareSchemas.create),ShareController.updateForReview);

/**
 * 🗑️ Révocation
 * POST /shares/:id/delete
 */
router.post("/shares/:id/delete", ShareController.destroy);

export default router;

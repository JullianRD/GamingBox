"use strict";

import { Router } from "express";
import TagController from "../../controller/TagController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as tagSchemas } from "../../validators/tagValidator.js";

const router = Router();

/**
 * Routes TAGS (utilisateur connecté)
 *
 * Pré-requis :
 * - utilisateur authentifié
 *
 * @see docs/user-stories.md#tags
 * @see docs/api-endpoints.md#tags
 */

// 🔐 Zone utilisateur connecté
router.use(requireAuth);

/**
 * 📋 Liste des tags
 * GET /tags
 */
router.get("/tags", TagController.index);

/**
 * ➕ Formulaire création
 * GET /tags/new
 */
router.get("/tags/new", TagController.new);

/**
 * ✅ Création
 * POST /tags
 */
router.post("/tags", validate(tagSchemas.create), TagController.store);

/**
 * 🔍 Détail d’un tag
 * GET /tags/:id
 */
router.get("/tags/:id", TagController.show);

/**
 * ✏️ Formulaire édition
 * GET /tags/:id/edit
 */
router.get("/tags/:id/edit", TagController.edit);

/**
 * 🔄 Mise à jour
 * POST /tags/:id
 *
 * (on réutilise le même schema, KISS)
 */
router.post("/tags/:id", validate(tagSchemas.create), TagController.update);

/**
 * 🗑️ Suppression
 * POST /tags/:id/delete
 *
 * (pas de validation : pas de body)
 */
router.post("/tags/:id/delete", TagController.destroy);

export default router;

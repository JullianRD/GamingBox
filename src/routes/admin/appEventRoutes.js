"use strict";

import { Router } from "express";
import AppEventController from "../../controllers/AppEventController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";

const router = Router();

/**
 * Routes ADMIN – App Events
 *
 * Pré-requis :
 * - utilisateur authentifié
 * - rôle admin
 *
 * @see docs/api-endpoints.md
 */
router.use(requireAuth);
router.use(requireAdmin);

/**
 * 📊 Statistiques globales
 * GET /admin/events/stats
 */
router.get("/events/stats", AppEventController.stats);

/**
 * 📜 Liste paginée des événements
 * GET /admin/events
 */
router.get("/events", AppEventController.index);

/**
 * 🔎 Détail d’un événement
 * GET /admin/events/:id
 */
router.get("/events/:id", AppEventController.show);

/**
 * 🗑️ Suppression exceptionnelle
 * DELETE /admin/events/:id
 */
router.delete("/events/:id", AppEventController.destroy);

/**
 * 🧹 Nettoyage des anciens événements
 * POST /admin/events/cleanup
 */
router.post("/events/cleanup", AppEventController.cleanup);

export default router;

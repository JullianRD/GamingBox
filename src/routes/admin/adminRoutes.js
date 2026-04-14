"use strict";

import { Router } from "express";
import AdminController from "../../controller/AdminController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";

const router = Router();

/**
 * Routes ADMIN
 *
 * Accès réservé aux administrateurs de l'app
 */

router.use(requireAuth);
router.use(requireAdmin);

// Dashboard
router.get("/admin", AdminController.index);

// Listes globales
router.get("/admin/users", AdminController.users);
router.get("/admin/reviews", AdminController.reviews);
router.get("/admin/tags", AdminController.tags);
router.get("/admin/shares", AdminController.shares);
router.get("/admin/games", AdminController.games);

// Suppressions globales
router.post("/admin/users/:id/delete", AdminController.destroyUser);
router.post("/admin/reviews/:id/delete", AdminController.destroyReview);
router.post("/admin/tags/:id/delete", AdminController.destroyTag);
router.post("/admin/shares/:id/delete", AdminController.destroyShare);
router.post("/admin/games/:id/delete", AdminController.destroyGame);

export default router;
"use strict";

import { Router } from "express";
import UserController from "../../controllers/UserController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";

const router = Router();

/**
 * Routes ADMIN – Utilisateurs
 *
 * Pré-requis :
 * - utilisateur authentifié
 * - rôle admin
 *
 * @see docs/user-stories.md#admin-users
 * @see docs/api-endpoints.md#admin-users
 */

// 🔐 Zone admin
router.use(requireAuth);
router.use(requireAdmin);

/**
 * 📋 Liste des utilisateurs
 * GET /admin/users
 */
router.get("/admin/users", UserController.index);

/**
 * 👤 Détail d’un utilisateur
 * GET /admin/users/:id
 */
router.get("/admin/users/:id", UserController.show);

export default router;

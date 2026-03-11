"use strict";

import { Router } from "express";
import HomeController from "../../controllers/HomeController.js";

const router = Router();

/**
 * Routes PUBLIQUES (Home / Marketing)
 *
 * Aucune authentification
 * Aucune donnée sensible
 *
 * @see docs/user-stories.md#public-pages
 */

/**
 * 🏠 Page d'accueil
 * GET /
 */
router.get("/", HomeController.home);

/**
 * ℹ️ À propos
 * GET /about
 */
router.get("/about", HomeController.about);

/**
 * 📬 Contact
 * GET /contact
 */
router.get("/contact", HomeController.contact);

/**
 * 📚 Documentation
 * GET /documentation
 */
router.get("/documentation", HomeController.documentation);

export default router;

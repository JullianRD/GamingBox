"use strict";

import { Router } from "express";

import homesRoutes from "./public/homeController.js";

// Nouvelles pages Cocon (par domaine)
import libraryRoutes from "../modules/library/routes.js";
import searchRoutes from "../modules/search/routes.js";
import importRoutes from "../modules/imports/routes.js";

// 🔐 Auth & compte
import authRoutes from "./public/authRoutes.js";
import profileRoutes from "./user/profileRoutes.js";

// 📦 Métier
import reviewRoutes from "./user/reviewRoutes.js";
import tagRoutes from "./user/tagRoutes.js";
import shareRoutes from "./user/shareRoutes.js";
import gameRoutes from "./user/gameRoutes.js";

// Admin
import adminRoutes from "./admin/adminRoutes.js";

// Router principal de l'application Cocon
const router = Router();

/**
 * Router principal de l'application
 *
 * Ce fichier :
 * - centralise toutes les routes
 * - définit les zones (public / auth / métier / admin)
 * - ne contient AUCUNE logique métier
 */

// Les modules Cocon passent avant les anciens routeurs, dont certains
// appliquent requireAuth à tout ce qui les traverse.
router.use(libraryRoutes);
router.use(searchRoutes);
router.use(importRoutes);

router.use(homesRoutes);

// Authentification utilisateur
router.use(authRoutes);
router.use(profileRoutes);

// Métier
router.use(reviewRoutes);
router.use(tagRoutes);
router.use(shareRoutes);
router.use(gameRoutes);

// Administration
router.use(adminRoutes);

export default router;
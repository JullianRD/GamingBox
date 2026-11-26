"use strict";

import { Router } from "express";

import homesRoutes from "./public/homeController.js";

// Nouvelles pages Cocon (par domaine)
import libraryRoutes from "../modules/library/routes.js";
import searchRoutes from "../modules/search/routes.js";
import importRoutes from "../modules/imports/routes.js";
import listRoutes from "../modules/lists/routes.js";
import socialRoutes from "../modules/social/routes.js";
import discoverRoutes from "../modules/discover/routes.js";

// 🔐 Auth & compte
import authRoutes from "./public/authRoutes.js";
import profileRoutes from "./user/profileRoutes.js";

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

// Les modules Cocon passent avant les routeurs historiques (accueil public, auth, profil, admin).
router.use(libraryRoutes);
router.use(searchRoutes);
router.use(importRoutes);
router.use(listRoutes);
router.use(socialRoutes);
router.use(discoverRoutes);

router.use(homesRoutes);

// Authentification utilisateur
router.use(authRoutes);
router.use(profileRoutes);

// Administration
router.use(adminRoutes);

export default router;
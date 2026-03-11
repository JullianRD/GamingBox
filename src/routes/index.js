"use strict"

import { Router } from "express";

import homesRoutes from "./public/homeController.js";


// 🔐 Auth & compte
import authRoutes from "./public/authRoutes.js";
import profileRoutes from "./user/profileRoutes.js";

// 📦 Métier
import reviewRoutes from "./user/reviewRoutes.js";
import tagRoutes from "./user/tagRoutes.js";
import shareRoutes from "./user/shareRoutes.js";
import gameRoutes from "./user/gameRoutes.js";

// Dashboard / pour les admins
import dashboardRoutes from "./admin/dashBoardRoutes.js";
import appEventRoutesRoutes from "./admin/appEventRoutesRoutes.js";
import userRoutes from "./admin/userRoutes.js";


// Router principal de l'application gamingbox
const router = Router();

/**
 * Router principal de l'application
 *
 * Ce fichier :
 * - centralise toutes les routes
 * - définit les zones (public / auth / métier)
 * - ne contient AUCUNE logique métier
 */

router.use(homesRoutes); // Page d'acceuil de gamingbox entre review index et l'authentification / register

// Authentification utilisateur
router.use(authRoutes);
router.use(profileRoutes);

// Métier
router.use(reviewRoutes);
router.use(tagRoutes);
router.use(shareRoutes);
router.use(gameRoutes);

export default router;

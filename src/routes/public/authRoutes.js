"use strict";

import { Router } from "express";
import { validate } from "../../middlewares/validationMiddleware.js";
import { injectCsrfToken } from "../../middlewares/csrfMiddleware.js";

import { schemas as authSchemas } from "../../validators/userValidator.js";
import AuthController from "../../controller/auth/AuthController.js";
import { requireGuest, requireAuth } from "../../middlewares/authMiddleware.js";
import { generateToken } from "../../config/security.js";

const router = Router();

// Routes pour authentifier et enregistrer l'utilisateur


// Inscription 

router.get(
    "/register",
    requireGuest,
    injectCsrfToken(generateToken),
    AuthController.showRegister,
);

router.post(
    "/register",
        AuthController.handleRegister
    );


// Connexion 

router.get(
    "/login",
    requireGuest,
    injectCsrfToken(generateToken),
    AuthController.showLogin,
);

router.post(
    "/login",
    requireGuest,
    validate(authSchemas.login),
    AuthController.handleLogin,
);


// Déconnexion
router.post(
    "/logout",
    requireAuth,
    AuthController.logout,
);

export default router;
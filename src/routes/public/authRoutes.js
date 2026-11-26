"use strict";

import { Router } from "express";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as authSchemas } from "../../validators/userValidator.js";
import AuthController from "../../controller/auth/AuthController.js";
import { requireGuest, requireAuth } from "../../middlewares/authMiddleware.js";
import { authLimiter } from "../../config/security.js";

const router = Router();

// Le jeton CSRF est exposé aux vues par le middleware global (res.locals.csrfToken)
// et vérifié pour tous les POST (voir src/app.js).

// Inscription
router.get("/register", requireGuest, AuthController.showRegister);
router.post(
  "/register",
  requireGuest,
  authLimiter,
  validate(authSchemas.register, { fallback: "/register" }),
  AuthController.handleRegister,
);

// Connexion
router.get("/login", requireGuest, AuthController.showLogin);
router.post(
  "/login",
  requireGuest,
  authLimiter,
  validate(authSchemas.login, { fallback: "/login" }),
  AuthController.handleLogin,
);

// Déconnexion
router.post("/logout", requireAuth, AuthController.logout);

// Vérification de l'email
router.get("/verify-email/:token", AuthController.verifyEmail);
router.post("/verify-email/resend", requireAuth, authLimiter, AuthController.resendVerification);

// Mot de passe oublié
router.get("/forgot-password", requireGuest, AuthController.showForgotPassword);
router.post(
  "/forgot-password",
  requireGuest,
  authLimiter,
  validate(authSchemas.forgotPassword, { fallback: "/forgot-password" }),
  AuthController.handleForgotPassword,
);
router.get("/reset-password/:token", requireGuest, AuthController.showResetPassword);
router.post(
  "/reset-password/:token",
  requireGuest,
  authLimiter,
  validate(authSchemas.resetPassword, { fallback: "/forgot-password" }),
  AuthController.handleResetPassword,
);

export default router;

"use strict";

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import logger from "./logger.js";

const isTestEnv = process.env.NODE_ENV === "test";

if (!isTestEnv && !process.env.CSRF_SECRET) {
  throw new Error("❌ CSRF_SECRET manquant. Ajoute-le dans ton fichier .env");
}

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

export const corsConfig = cors({
  origin: process.env.APP_FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === "127.0.0.1",
});

// Connexion et inscription : 10 échecs par heure et par IP (les réussites ne comptent pas)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: "Trop de tentatives de connexion. Réessaie plus tard.",
});

let generateCsrfToken;
let doubleCsrfProtection;
let invalidCsrfTokenError;

if (!isTestEnv) {
  const csrf = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,

    // À remplacer plus tard par un vrai identifiant de session/utilisateur
    getSessionIdentifier: (req) => req.ip || "dev-session",

    cookieName: process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf",

    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },

    // IMPORTANT pour les formulaires SSR
    // Formulaires classiques (champ _csrf) ou requêtes htmx (en-tête posé par le layout)
    getCsrfTokenFromRequest: (req) => req.body?._csrf || req.get("X-CSRF-Token"),

    errorConfig: {
      statusCode: 403,
      message: "invalid csrf token",
      code: "EBADCSRFTOKEN",
    },
  });

  generateCsrfToken = csrf.generateCsrfToken;
  doubleCsrfProtection = csrf.doubleCsrfProtection;
  invalidCsrfTokenError = csrf.invalidCsrfTokenError;
} else {
  generateCsrfToken = () => "test-token";
  doubleCsrfProtection = (req, res, next) => next();
  invalidCsrfTokenError = null;
}

export function generateToken(req, res) {
  return generateCsrfToken(req, res);
}

export { doubleCsrfProtection, invalidCsrfTokenError };

export const cookieParserMiddleware = cookieParser();
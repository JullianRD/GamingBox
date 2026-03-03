"use strict";

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import logger from "./logger.js";

/**
 * Configuration sécurité globale de l'application
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html
 * @see https://github.com/Psifi-Solutions/csrf-csrf
 */

const isTestEnv = process.env.NODE_ENV === "test";

// ═══════════════════════════════════════════════════════════════
// FAIL FAST — CSRF SECRET OBLIGATOIRE (sauf en test)
// ═══════════════════════════════════════════════════════════════

if (!isTestEnv && !process.env.CSRF_SECRET) {
  throw new Error("❌ CSRF_SECRET manquant. Ajoute-le dans ton fichier .env");
}

// ═══════════════════════════════════════════════════════════════
// HEADERS DE SÉCURITÉ (Helmet)
// ═══════════════════════════════════════════════════════════════

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════

export const corsConfig = cors({
  origin: process.env.APP_FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === "127.0.0.1",
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Trop de tentatives de connexion. Réessayez plus tard.",
});

// ═══════════════════════════════════════════════════════════════
// CSRF (Double Submit Cookie)
// Désactivé en environnement test
// ═══════════════════════════════════════════════════════════════

let generateCsrfToken;
let doubleCsrfProtection;

if (!isTestEnv) {
  const csrf = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,

    /**
     * Identifiant de pseudo-session stable (SSR friendly)
     * @see https://github.com/Psifi-Solutions/csrf-csrf#without-express-session
     */
    getSessionIdentifier: () => "dev-session",

    cookieName: process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf",

    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },

    onError: (req, res) => {
      logger.warn({ ip: req.ip, url: req.originalUrl }, "❌ CSRF détecté");

      return res.status(403).render("pages/errors/403", {
        title: "Action non autorisée",
        message: "Action non autorisée ou session expirée.",
      });
    },
  });

  generateCsrfToken = csrf.generateCsrfToken;
  doubleCsrfProtection = csrf.doubleCsrfProtection;
} else {
  // ✅ En test → bypass complet
  generateCsrfToken = () => "test-token";
  doubleCsrfProtection = (req, res, next) => next();
}

/**
 * Génère un token CSRF pour les vues SSR
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {string}
 */
export function generateToken(req, res) {
  return generateCsrfToken(req, res);
}

export { doubleCsrfProtection };

// ═══════════════════════════════════════════════════════════════
// COOKIES
// ═══════════════════════════════════════════════════════════════

export const cookieParserMiddleware = cookieParser();




// Ce fichier configure toutes les protections majeures :

// Protection     ->	            But
// Helmet / CSP   ->	XSS, injection, clickjacking
// CORS  ->  	        Contrôle les origines autorisées
// Rate limit   ->  	Brute force / DDoS léger
// Double CSRF  ->  	CSRF (Cross Site Request Forgery)
// cookie-parser  -> 	Lire les cookies HTTP

// ✅ Sécurité en prod adaptée
// ✅ Dev et test friendly
// ✅ Logs et erreurs contrôlées
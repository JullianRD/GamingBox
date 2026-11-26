"use strict";

import helmet from "helmet";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import { env } from "./env.js";

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.igdb.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
});

export const corsConfig = cors({
  origin: env.APP_FRONTEND_URL,
  credentials: true,
});

const rateLimitHandlerOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

export const globalLimiter = rateLimit({
  ...rateLimitHandlerOptions,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  skip: (req) => env.isTest || req.ip === "127.0.0.1",
});

/**
 * Limiteur strict pour les routes sensibles (login, inscription, reset...).
 * Seules les tentatives échouées comptent : un contrôleur marque la requête
 * comme réussie via `res.locals.authOk = true`.
 */
export const authLimiter = rateLimit({
  ...rateLimitHandlerOptions,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 10),
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.locals.authOk === true,
  skip: () => env.isTest && !process.env.AUTH_RATE_LIMIT,
  handler: (req, res, next) => {
    req.flash?.("error", "Trop de tentatives. Réessayez dans quelques minutes.");
    const target = req.path.startsWith("/register") ? "/register" : "/login";
    res.redirect(target);
  },
});

/** Limiteur des appels IGDB (quota Twitch partagé) : 30 requêtes / minute / utilisateur. */
export const igdbLimiter = rateLimit({
  ...rateLimitHandlerOptions,
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.session?.userId || ipKeyGenerator(req.ip),
  skip: () => env.isTest,
  handler: (_req, res) => res.status(429).json({ error: "Trop de requêtes, réessaie dans une minute." }),
});

/**
 * Protection CSRF (double submit cookie signé), liée à l'identifiant de session.
 *
 * - appliquée globalement sur toutes les méthodes non sûres (POST, PUT, DELETE...)
 * - les formulaires multipart (upload) sont ignorés par la protection globale car
 *   le corps n'est lisible qu'après multer : ces routes réappliquent la protection
 *   via `csrfAfterMultipart`.
 */
const csrf = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.session?.id ?? "",
  cookieName: env.isProduction ? "__Host-gamingbox.csrf" : "gamingbox.csrf",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
  },
  // Formulaires SSR (champ caché) ou requêtes fetch (en-tête)
  getCsrfTokenFromRequest: (req) => req.body?._csrf || req.get("x-csrf-token"),
  skipCsrfProtection: (req) => req.is("multipart/form-data") && !req.csrfAfterMultipart,
  errorConfig: {
    statusCode: 403,
    message: "Jeton CSRF invalide ou manquant.",
    code: "EBADCSRFTOKEN",
  },
});

export const generateToken = (req, res) => csrf.generateCsrfToken(req, res);
export const doubleCsrfProtection = csrf.doubleCsrfProtection;
export const invalidCsrfTokenError = csrf.invalidCsrfTokenError;

/** À placer APRÈS multer sur les routes d'upload. */
export const csrfAfterMultipart = [
  (req, _res, next) => {
    req.csrfAfterMultipart = true;
    next();
  },
  csrf.doubleCsrfProtection,
];

/**
 * Persiste la session anonyme (id stable) afin que le jeton CSRF puisse y être lié,
 * puis expose `csrfToken` aux vues (`<%= csrfToken %>`).
 */
export const csrfContext = (req, res, next) => {
  if (!req.session.csrfBound) req.session.csrfBound = true;

  // Un seul jeton (et un seul cookie) par réponse, même si la vue le lit plusieurs fois
  let token;
  Object.defineProperty(res.locals, "csrfToken", {
    configurable: true,
    enumerable: true,
    get: () => (token ??= generateToken(req, res)),
  });
  next();
};

export const cookieParserMiddleware = cookieParser();

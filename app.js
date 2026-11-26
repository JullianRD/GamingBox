"use strict";
/**
 * @fileoverview Point d'entrée principal de l'application Cocon
 */
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import expressLayouts from "express-ejs-layouts";
import { logger } from "./src/config/logger.js";
import { ITEM_TYPES, STATUSES } from "./src/utils/itemTypes.js";

// Routes
import routes from "./src/routes/index.js";

// Sécurité & session
import {
  securityHeaders,
  corsConfig,
  generateToken,
  globalLimiter,
  cookieParserMiddleware,
} from "./src/config/security.js";
import { sessionMiddleware } from "./src/config/session.js";

// Middlewares métier
import { flashMiddleware } from "./src/middlewares/flashMiddleware.js";
import { injectUserToLocals } from "./src/middlewares/authMiddleware.js";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./src/middlewares/errorMiddleware.js";

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION ESM
// ═══════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// INITIALISATION EXPRESS
// ═══════════════════════════════════════════════════════════════

const app = express();
// Derrière le reverse proxy de l'hébergeur (OBLIGATOIRE en production)
if(process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARES DE BASE
// ═══════════════════════════════════════════════════════════════
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static(path.join(__dirname, "public")));
// htmx servi depuis node_modules (pas de CDN)
app.get("/vendor/htmx.min.js", (req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/htmx.org/dist/htmx.min.js")),
);

// ═══════════════════════════════════════════════════════════════
// SÉCURITÉ GLOBALE
// cookieParser DOIT passer AVANT session & CSRF
// ═══════════════════════════════════════════════════════════════

app.use(cookieParserMiddleware);
app.use(securityHeaders);
app.use(corsConfig);
app.use(globalLimiter);

// ═══════════════════════════════════════════════════════════════
// SESSION (PostgreSQL)
// ═══════════════════════════════════════════════════════════════

app.use(sessionMiddleware);

// ═══════════════════════════════════════════════════════════════
// FLASH & CONTEXTE UTILISATEUR
// ═══════════════════════════════════════════════════════════════

app.use(flashMiddleware);
app.use(injectUserToLocals);
app.use((req, res, next) => {
  res.locals.currentPath = req.path; // onglet actif dans la navigation
  res.locals.itemTypes = ITEM_TYPES;
  res.locals.statuses = STATUSES;
  res.locals.section = null; // thème léger de la section courante (data-section)
  res.locals.csrfToken = generateToken(req, res); // jeton commun aux formulaires et à htmx
  next();
});

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION EJS
// ═══════════════════════════════════════════════════════════════

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

app.use("/", routes);  // Définit ou les utilisateur doivent spawn

// ═══════════════════════════════════════════════════════════════
// 404
// ═══════════════════════════════════════════════════════════════

app.use(notFoundHandler);

// ═══════════════════════════════════════════════════════════════
// ERREURS GLOBALES
// ═══════════════════════════════════════════════════════════════

app.use(globalErrorHandler);

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(
    { port: PORT, env: process.env.NODE_ENV || "development" },
    `Cocon démarré sur http://localhost:${PORT}`,
  );
});

// ═══════════════════════════════════════════════════════════════
// ARRÊT PROPRE
// ═══════════════════════════════════════════════════════════════

process.on("SIGINT", () => {
  logger.info("Arrêt du serveur Cocon");
  process.exit(0);
});

export default app;

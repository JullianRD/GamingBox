"use strict";
/**
 * @fileoverview Point d'entrée principal de l'application Gamingbox
 */
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import expressLayouts from "express-ejs-layouts";

// Routes
import routes from "./src/routes/index.js";

// Sécurité & session
import {
  securityHeaders,
  corsConfig,
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
// Railway / Reverse proxy support (OBLIGATOIRE en production)
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
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🐼 GAMINGBOX - list de jeux personelle !               ║
║                                                           ║
║   🚀 Serveur lancé avec succès !                         ║
║   📍 URL: http://localhost:${PORT}                         ║
║   🌐 Environnement: ${process.env.NODE_ENV || "development"}                      ║
║   ⏰ Démarré le: ${new Date().toLocaleString("fr-FR")}    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// ═══════════════════════════════════════════════════════════════
// ARRÊT PROPRE
// ═══════════════════════════════════════════════════════════════

process.on("SIGINT", () => {
  console.log("\n\n👋 Arrêt du serveur GamingBox...");
  process.exit(0);
});

export default app;

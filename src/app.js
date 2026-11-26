"use strict";
/**
 * Construction de l'application Express (sans écoute réseau, donc testable).
 * Le démarrage du serveur est dans /app.js.
 */
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import expressLayouts from "express-ejs-layouts";

import routes from "./routes/index.js";
import { env } from "./config/env.js";
import { httpLogger } from "./config/logger.js";
import { pool } from "./config/database.js";
import {
  securityHeaders,
  corsConfig,
  globalLimiter,
  cookieParserMiddleware,
  csrfContext,
  doubleCsrfProtection,
} from "./config/security.js";
import { sessionMiddleware } from "./config/session.js";
import { flashMiddleware } from "./middlewares/flashMiddleware.js";
import { injectUserToLocals } from "./middlewares/authMiddleware.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/errorMiddleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  // Derrière un reverse proxy (Railway, Render...) : nécessaire pour req.ip, cookies secure
  if (env.isProduction) app.set("trust proxy", 1);

  app.use(httpLogger);

  // Fichiers statiques : servis avant la session pour ne pas solliciter la base
  app.use(express.static(path.join(ROOT, "public"), { maxAge: env.isProduction ? "1d" : 0 }));

  // Health check : liveness + accès base de données (sans session)
  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", uptime: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: "degraded", database: "unreachable" });
    }
  });

  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  app.use(cookieParserMiddleware);
  app.use(securityHeaders);
  app.use(corsConfig);
  app.use(globalLimiter);

  app.use(sessionMiddleware);
  app.use(flashMiddleware);
  app.use(injectUserToLocals);

  // CSRF : jeton exposé aux vues (`csrfToken`) puis vérification de tous les POST/PUT/DELETE
  app.use(csrfContext);
  app.use(doubleCsrfProtection);

  app.set("view engine", "ejs");
  app.set("views", path.join(ROOT, "src", "views"));
  app.use(expressLayouts);
  app.set("layout", "layouts/main");
  app.set("layout extractScripts", true);
  app.set("layout extractStyles", true);

  app.use("/", routes);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

export default createApp;

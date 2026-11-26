"use strict";
/**
 * Point d'entrée : démarre le serveur HTTP.
 */
import { env } from "./src/config/env.js";
import { logger } from "./src/config/logger.js";
import { pool } from "./src/config/database.js";
import { createApp } from "./src/app.js";
import { startMaintenance, stopMaintenance } from "./src/services/MaintenanceService.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "GamingBox démarré");
  startMaintenance();
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Arrêt du serveur...");
  stopMaintenance();

  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });

  // Filet de sécurité si des connexions restent ouvertes
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "unhandledRejection"));

export default app;

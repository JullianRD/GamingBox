"use strict";
// src/config/database.js
import dotenv from "dotenv";
dotenv.config();
import pg from "pg";
import { logger } from "./logger.js";

const { Pool } = pg; // Import du gestionnaire de connexions, ouvre un groupe de connexions reutilisables au lieu d'une co par requêtes

// Vérification de sécurité au demarrage
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV !== "test") {
    const errorMsg =
      "La variable DATABASE_URL est manquante dans le fichier .env ";
    logger.fatal(errorMsg); // Log critique
    throw new Error(errorMsg);
  }
}

/**
 * SSL : obligatoire sur Neon et la plupart des hébergeurs managés.
 * - DB_SSL=true force le SSL, DB_SSL=false le désactive
 * - sinon, il est activé si l'URL contient sslmode=require (cas des URL Neon)
 * Les certificats sont vérifiés (rejectUnauthorized: true), sauf si
 * DB_SSL_REJECT_UNAUTHORIZED=false est défini explicitement.
 */
export const resolveSsl = (env = process.env) => {
  const url = env.DATABASE_URL || "";
  const enabled =
    env.DB_SSL !== undefined
      ? env.DB_SSL === "true"
      : /sslmode=(require|verify-ca|verify-full)/.test(url);

  if (!enabled) return false;
  return { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== "false" };
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(),
  // Neon fournit un pooler (URL en -pooler) : un petit pool local suffit
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  // Laisse le temps à une base Neon en veille de se réveiller
  connectionTimeoutMillis: 10000,
});

// Evenements du pool pour le monitoring
pool.on("connect", () => {
  logger.debug("🐘 PostgreSQL connected");
});

pool.on("error", (err) => {
  logger.error({ err }, "❌ Unexpected error on idle database client");
  process.exit(-1); // En cas de perte critique de DB, mieux vaut redémarrer l'app
});

export default pool;


// Ce fichier :

// centralise la connexion DB
// sécurise le démarrage
// adapte SSL selon environnement
// surveille les erreurs critiques
// exporte un pool réutilisable
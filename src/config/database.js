"use strict";
// src/config/database.js
import pg from "pg";
import { env } from "./env.js";
import { logger } from "./logger.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // SSL en production : la vérification du certificat reste activée par défaut.
  // Pour un hébergeur à certificat auto-signé, définir DB_SSL_REJECT_UNAUTHORIZED=false
  // (ou mieux : fournir la CA via NODE_EXTRA_CA_CERTS).
  ssl: env.isProduction ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Erreur inattendue sur un client PostgreSQL inactif");
});

/**
 * Exécute `fn(client)` dans une transaction.
 * COMMIT si `fn` réussit, ROLLBACK (puis relance de l'erreur) sinon.
 *
 * @template T
 * @param {(client: import("pg").PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ err: rollbackError }, "ROLLBACK impossible");
    }
    throw error;
  } finally {
    client.release();
  }
}

export default pool;

"use strict";
/**
 * Tâches de maintenance périodiques :
 * - purge des événements applicatifs au-delà de la rétention (EVENTS_RETENTION_DAYS)
 * - purge des jetons d'authentification expirés
 */
import db from "../config/database.js";
import { env } from "../config/env.js";
import logger from "../config/logger.js";

let timer = null;

export async function runMaintenance() {
  const events = await db.query(
    "DELETE FROM app_events WHERE created_at < now() - ($1::int * interval '1 day')",
    [env.EVENTS_RETENTION_DAYS],
  );
  const tokens = await db.query(
    "DELETE FROM auth_tokens WHERE expires_at < now() - interval '1 day' OR used_at < now() - interval '7 days'",
  );
  logger.info({ events: events.rowCount, tokens: tokens.rowCount }, "Maintenance terminée");
  return { events: events.rowCount, tokens: tokens.rowCount };
}

export function startMaintenance({ everyMs = 6 * 60 * 60 * 1000 } = {}) {
  if (timer) return;
  const run = () => runMaintenance().catch((err) => logger.error({ err }, "Maintenance en échec"));
  setTimeout(run, 30_000).unref();
  timer = setInterval(run, everyMs);
  timer.unref();
}

export function stopMaintenance() {
  if (timer) clearInterval(timer);
  timer = null;
}

"use strict";
/**
 * Validation des variables d'environnement au démarrage.
 * En production, l'absence d'un secret fait échouer le boot (fail fast).
 */
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const requiredInProd = (schema) => (isProduction ? schema : schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  APP_FRONTEND_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  SESSION_SECRET: requiredInProd(z.string().min(32, "SESSION_SECRET: 32 caractères minimum")),
  CSRF_SECRET: requiredInProd(z.string().min(32, "CSRF_SECRET: 32 caractères minimum")),
  IGDB_CLIENT_ID: z.string().optional(),
  IGDB_CLIENT_SECRET: z.string().optional(),
  // Emails (SMTP). Sans SMTP_HOST, les emails sont écrits dans les logs (dev/test).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("GamingBox <no-reply@gamingbox.local>"),
  // Sentry-compatible (optionnel) : DSN reçu via variable d'environnement
  SENTRY_DSN: z.string().optional(),
  // Rétention des événements applicatifs (jours)
  EVENTS_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `- ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Configuration invalide :\n${details}`);
}

if (!isTest && !parsed.data.DATABASE_URL) {
  throw new Error("Configuration invalide :\n- DATABASE_URL: variable manquante");
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction,
  isTest,
  // Valeurs de repli réservées à NODE_ENV=test / development (jamais en production)
  SESSION_SECRET:
    parsed.data.SESSION_SECRET ?? "dev-only-session-secret-change-me-0123456789",
  CSRF_SECRET: parsed.data.CSRF_SECRET ?? "dev-only-csrf-secret-change-me-0123456789ab",
});

export default env;

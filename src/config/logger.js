"use strict";
// src/config/logger.js
import crypto from "node:crypto";
import fs from "node:fs";
import pino from "pino";
import pinoHttp from "pino-http";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

/**
 * Options de base pour pino.
 * `redact` masque les données sensibles où qu'elles apparaissent dans un log.
 */
const baseLoggerOptions = {
  level: isTest ? "silent" : process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "passwordHash",
      "password_hash",
      "*.password",
      "*.passwordHash",
      "*.password_hash",
      "req.headers.cookie",
      "req.headers.authorization",
      'res.headers["set-cookie"]',
    ],
    censor: "[REDACTED]",
  },
};

/**
 * Dev : sortie lisible + fichier JSON local. Prod/test : JSON brut sur stdout.
 */
function buildTransport() {
  if (isProduction || isTest) return undefined;

  if (!fs.existsSync("./logs")) fs.mkdirSync("./logs", { recursive: true });

  return pino.transport({
    targets: [
      {
        target: "pino-pretty",
        options: {
          destination: 1,
          colorize: true,
          translateTime: "yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
      {
        target: "pino/file",
        options: { destination: "./logs/app.log", mkdir: true },
      },
    ],
  });
}

/** @type {pino.Logger} */
export const logger = pino(baseLoggerOptions, buildTransport());

/**
 * Logger HTTP : chaque requête reçoit un identifiant (`req.id`), repris dans
 * l'en-tête de réponse X-Request-Id pour faciliter le support.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-request-id"];
    const id =
      typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming)
        ? incoming
        : crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  autoLogging: {
    ignore: (req) =>
      req.method === "OPTIONS" ||
      req.url.startsWith("/css") ||
      req.url.startsWith("/js") ||
      req.url.startsWith("/images") ||
      req.url.startsWith("/favicon.ico") ||
      req.url === "/health",
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

export default logger;

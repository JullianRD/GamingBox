"use strict";
// src/config/logger.js
import pino from "pino";
import fs from "fs";

const isDevelopment = process.env.NODE_ENV !== "production";

// Création automatique du dossier logs s'il n'existe pas (en dev)
if (isDevelopment && !fs.existsSync("./logs")) {
  fs.mkdirSync("./logs");
}

/**
 * Options de base pour pino
 * @type {pino.LoggerOptions}
 */
const baseLoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
};

const transport = isDevelopment
  ? pino.transport({
      targets: [
        // Cible 1 : console jolie
        {
          target: "pino-pretty",
          options: {
            destination: 1,
            colorizer: true,
            translateTime: "yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
            messageFormat: "{level} {time} {msg}",
          },
        },
        // Cible 2 : Fichier JSON (pour garder l'historique local)
        {
          target: "pino/file",
          options: {
            destination: "./logs/app.log",
            mkdir: true,
          },
        },
      ],
    })
  : undefined;

/**
 * Créer et exporte le logger Pino principal
 * @type {pino.Logger}
 */
export const logger = pino(baseLoggerOptions, transport);

export default logger;

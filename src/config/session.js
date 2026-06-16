"use strict";

import session from "express-session"; // middleware pour gérer les sessions Express.
import connectPgSession from "connect-pg-simple"; // permet de stocker les sessions dans PostgreSQL au lieu de la mémoire.
import { pool as pgPool } from "./database.js"; // connexion PostgreSQL centralisée.
import logger from "./logger.js"; // pour loguer les erreurs éventuelles du store.

const PgSession = connectPgSession(session);

export const SESSION_COOKIE_NAME = "gamingbox.sid";

/**
 * Middleware express-session configuré avec PostgreSQL
 */
export const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: process.env.SESSION_SECRET || "CHANGE_ME_IN_PRODUCTION",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
  store: new PgSession({
    pool: pgPool,
    tableName: "user_sessions",
    pruneExpired: true,
    errorLog: (err) => {
      logger.error({ err }, "❌ Erreur store session PostgreSQL");
    },
  }),
});

export const sessionTableConfig = {
  tableName: "user_sessions",
};

// Comment ça fonctionne concrètement

// Lorsqu’un utilisateur se connecte → Express crée une session et génère un cookie signé.
// La session est stockée dans la table user_sessions de PostgreSQL.
// À chaque requête suivante → Express lit le cookie, récupère la session dans la DB.
// Si la session expire ou est supprimée → l’utilisateur est déconnecté automatiquement.
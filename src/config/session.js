"use strict";

import session from "express-session"; // sessions Express
import connectPgSession from "connect-pg-simple"; // stockage des sessions dans PostgreSQL
import { pool as pgPool } from "./database.js";
import { env } from "./env.js";
import logger from "./logger.js";

const PgSession = connectPgSession(session);

export const SESSION_COOKIE_NAME = "gamingbox.sid";

/**
 * Middleware express-session configuré avec PostgreSQL.
 * Le secret vient de la configuration validée (obligatoire, 32 car. min. en production).
 */
export const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.isProduction,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
  store: new PgSession({
    pool: pgPool,
    tableName: "user_sessions",
    pruneSessionInterval: env.isTest ? false : 60 * 15,
    errorLog: (err) => {
      logger.error({ err }, "Erreur du store de session PostgreSQL");
    },
  }),
});

export const sessionTableConfig = {
  tableName: "user_sessions",
};

/**
 * Promisifie `req.session.regenerate` (anti-fixation de session).
 * Conserve le flash éventuel.
 */
export function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

"use strict";
/**
 * Jetons à usage unique (vérification d'email, reset de mot de passe).
 * Seul le hash SHA-256 est stocké : un dump de la base ne permet pas de les rejouer.
 */
import crypto from "node:crypto";
import db from "../config/database.js";

export const TOKEN_TYPES = Object.freeze({
  EMAIL_VERIFY: "email_verify",
  PASSWORD_RESET: "password_reset",
});

const TTL_MS = {
  [TOKEN_TYPES.EMAIL_VERIFY]: 24 * 60 * 60 * 1000,
  [TOKEN_TYPES.PASSWORD_RESET]: 60 * 60 * 1000,
};

export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

class TokenService {
  /** Crée un jeton (et invalide les précédents du même type). Retourne le jeton en clair. */
  static async issue(userId, type) {
    const token = crypto.randomBytes(32).toString("base64url");

    await db.query(
      "UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL",
      [userId, type],
    );
    await db.query(
      "INSERT INTO auth_tokens (user_id, token_type, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [userId, type, hashToken(token), new Date(Date.now() + TTL_MS[type])],
    );

    return token;
  }

  /** Consomme atomiquement un jeton valide. Retourne l'id utilisateur ou null. */
  static async consume(token, type) {
    if (typeof token !== "string" || token.length < 20 || token.length > 128) return null;

    const { rows } = await db.query(
      /*sql*/ `
        UPDATE auth_tokens SET used_at = now()
        WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [hashToken(token), type],
    );
    return rows[0]?.user_id ?? null;
  }

  /** Vérifie sans consommer (affichage du formulaire de reset). */
  static async peek(token, type) {
    if (typeof token !== "string" || token.length < 20 || token.length > 128) return false;
    const { rowCount } = await db.query(
      "SELECT 1 FROM auth_tokens WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > now()",
      [hashToken(token), type],
    );
    return rowCount > 0;
  }
}

export default TokenService;

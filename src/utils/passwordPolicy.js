"use strict";
/**
 * Contrôle des mots de passe compromis via l'API Have I Been Pwned (k-anonymat) :
 * seuls les 5 premiers caractères du SHA-1 quittent le serveur.
 * Échec réseau = on laisse passer (fail-open) : ce contrôle ne doit pas bloquer l'inscription.
 */
import crypto from "node:crypto";
import { env } from "../config/env.js";
import logger from "../config/logger.js";

export async function isPasswordPwned(password, { fetchImpl = fetch, timeoutMs = 2500 } = {}) {
  if (env.isTest && fetchImpl === fetch) return false;

  try {
    const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "GamingBox" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;

    const body = await response.text();
    return body.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch (err) {
    logger.warn({ err: err.message }, "Contrôle HIBP indisponible");
    return false;
  }
}

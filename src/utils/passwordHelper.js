"use strict";
import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * Configuration Argon2id (recommandations OWASP)
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(password) {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashed, password) {
  try {
    return await verify(hashed, password);
  } catch {
    // hash illisible ou mot de passe invalide : jamais d'exception vers l'appelant
    return false;
  }
}

let dummyHashPromise = null;

/**
 * Vérification factice : à appeler quand l'utilisateur n'existe pas afin que le temps
 * de réponse ne révèle pas si un email est inscrit.
 */
export async function verifyDummyPassword(password) {
  dummyHashPromise ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHashPromise, password);
  return false;
}

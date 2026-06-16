"use strict";
import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * Configuration Argon2 (OWASP recommendations)
 * ⚠️ À utiliser UNIQUEMENT pour les rehash automatiques
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(password) {
  return await hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashed, password) {
  try {
    return verify(hashed, password);
  } catch (error) {
    return false;
  }
}



// Ce fichier sert à : 

// ✔ centralise la sécurité des mots de passe
// ✔ respecte les recommandations OWASP
// ✔ protège contre les attaques brute-force
// ✔ évite les erreurs dans les controllers/services


// Avant d'être stocké en base le mot de passe de l'utilisateur est hashé pour de la sécurité
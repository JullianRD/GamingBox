"use strict";

/**
 * UserDTO : format sécurisé exposé aux vues / API publiques.
 *
 * - Ne contient jamais de password, password_hash, token, ou champs internes.
 * - N'effectue pas de validation Zod ; il suppose que la donnée provient d'une source fiable.
 *
 * Docs projet : ./docs/api-endpoints.md
 */

/**
 * @typedef {Object} UserEntityLike
 * @property {string} id
 * @property {string} email
 * @property {string} pseudo
 * @property {string} biographie
 * @property {string} role_name
 * @property {Object|null} preferences
 * @property {boolean|null} gdpr_consent
 * @property {string|null} created_at
 */

/**
 * Retour complet pour page profil
 * @param {UserEntityLike} user
 * @returns {{ id: string, email: string, pseudo: string, role: string, preferences: Object, gdprConsent: boolean, createdAt: string|null }}
 */
export function profileDTO(user) {
  return {
    id: user.id,
    email: user.email,
    pseudo: user.pseudo,
    biographie: user.biographie,
    role: user.role_name || "user",
    preferences: user.preferences ?? {},
    gdprConsent: Boolean(user.gdpr_consent),
    createdAt: user.created_at ?? null,
  };
}

/**
 * Version minimale (ex: navbar)
 * @param {UserEntityLike} user
 * @returns {{ id: string, pseudo: string, role: string }}
 */
export function minimalDTO(user) {
  return {
    id: user.id,
    pseudo: user.pseudo,
    role: user.role_name || "user",
  };
}

/**
 * Exporte un créateur unique si tu veux classer.
 */
export const UserDTO = {
  profile: profileDTO,
  minimal: minimalDTO,
};

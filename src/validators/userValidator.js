"use strict";

import { z } from "zod";

/**
 * User validators (Zod latest)
 *
 * - Conçus pour SSR (HTML forms) et API.
 * - Transformations légères pour rendre la vie au controller plus simple.
 *
 * Docs Zod : https://zod.dev
 */

/* ---------- petites règles réutilisables ---------- */

/** Mot de passe : minimum*/
const passwordMin = 8;

/** Pseudo : caractères simples */
const PSEUDO_REGEX = /^[a-zA-Z0-9._-]+$/;

/* ---------- Schemas ---------- */

/**
 * Schéma d'inscription
 *
 */
export const registerSchema = z.object({
  email: z
    .email({ message: "Format d'email invalide" })
    .min(5, { message: "L'email doit contenir au moins 5 caractères" })
    .max(255, { message: "L'email ne peut pas dépasser 255 caractères" }),

  password: z
    .string()
    .min(passwordMin, {
      message: `Le mot de passe doit contenir au moins ${passwordMin} caractères`,
    })
    .max(100, { message: "Le mot de passe est trop long" }),

  pseudo: z
    .string()
    .min(3, { message: "Le pseudo est trop court" })
    .max(50, { message: "Le pseudo est trop long" })
    .regex(PSEUDO_REGEX, {
      message: "Le pseudo ne peut contenir que lettres, chiffres, ., _ et -",
    }),

  gdpr_consent: z.stringbool().optional(),
});

/**
 * Schéma de connexion
 */
export const loginSchema = z.object({
  email: z.email({ message: "Format d'email invalide" }).min(5).max(255),

  password: z.string().min(1, { message: "Mot de passe requis" }),
});

/**
 * Schéma de mise à jour de profil
 * - tous optionnels ; transforme gdpr_consent si envoyé.
 */
export const updateProfileSchema = z.object({
  email: z
    .email({ message: "Format d'email invalide" })
    .min(5)
    .max(255)
    .optional(),

  password: z.string().min(passwordMin).max(100).optional(),

  pseudo: z.string().min(3).max(50).regex(PSEUDO_REGEX).optional(),

  preferences: z
    .object({
      theme: z.enum(["light", "dark"]).optional(),
      language: z.enum(["en", "fr"]).optional(),
    })
    .optional(),

  gdpr_consent: z.stringbool().optional(),
});

/* ---------- Helpers exportés (optionnel) ---------- */

/**
 * Parse sécurisé pour usage direct.
 * Exemple : try { const data = registerSchema.parse(req.body) } catch (e) { ... }
 */
export const schemas = {
  register: registerSchema,
  login: loginSchema,
  updateProfile: updateProfileSchema,
};

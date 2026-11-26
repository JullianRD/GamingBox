"use strict";

import { z } from "zod";

/**
 * Validateurs utilisateur (Zod 4) pour formulaires SSR et API.
 * @see https://zod.dev
 */

const passwordMin = 8;
const PSEUDO_REGEX = /^[a-zA-Z0-9._-]+$/;

const email = z
  .email({ message: "Format d'email invalide" })
  .max(255, { message: "L'email ne peut pas dépasser 255 caractères" })
  .transform((value) => value.trim().toLowerCase());

const password = z
  .string()
  .min(passwordMin, { message: `Le mot de passe doit contenir au moins ${passwordMin} caractères` })
  .max(100, { message: "Le mot de passe est trop long" });

const pseudo = z
  .string()
  .trim()
  .min(3, { message: "Le pseudo est trop court" })
  .max(50, { message: "Le pseudo est trop long" })
  .regex(PSEUDO_REGEX, { message: "Le pseudo ne peut contenir que lettres, chiffres, ., _ et -" });

/** Case à cocher HTML : absente (non cochée) => false, "on"/"true" => true */
const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true" || value === "1");

export const registerSchema = z.object({
  email,
  password,
  pseudo,
  gdprConsent: checkbox.refine((value) => value === true, {
    message: "Le consentement RGPD est requis pour créer un compte",
  }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: "Mot de passe requis" }).max(100),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfirm"],
  });

export const updateProfileSchema = z.object({
  pseudo,
  biographie: z
    .string()
    .trim()
    .max(500, { message: "La biographie ne peut pas dépasser 500 caractères" })
    .optional()
    .transform((value) => value || null),
  profilePublic: checkbox,
});

export const schemas = {
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  updateProfile: updateProfileSchema,
};

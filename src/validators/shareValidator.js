"use strict";

import { z } from "zod";

/**
 * Validation des partages
 *
 * @see https://zod.dev
 */
const shareBaseSchema = z.object({
  recipientEmail: z.email("Email du destinataire invalide"),

  redirectTo: z.string().trim().optional(),

  message: z
    .string()
    .trim()
    .max(500, "Le message ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  allow_download: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
    .optional(),

  expiration: z.string().trim().optional().or(z.literal("")),

  maxViews: z
    .union([
      z.string().trim(),
      z.number(),
    ])
    .optional()
    .refine(
      (value) => {
        if (value === undefined || value === null || value === "") {
          return true;
        }

        const num = Number(value);
        return Number.isInteger(num) && num > 0;
      },
      {
        message: "Le nombre maximal de vues doit être un entier positif",
      },
    ),
});

export const schemas = {
  createProfile: shareBaseSchema.extend({
    userId: z.uuid("Identifiant de profil invalide").optional(),
  }),

  createReview: shareBaseSchema.extend({
    reviewId: z.uuid("Identifiant de review invalide"),
  }),
};
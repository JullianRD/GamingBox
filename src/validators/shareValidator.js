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
});

export const schemas = {
  createProfile: shareBaseSchema.extend({
    userId: z.uuid("Identifiant de profil invalide"),
  }),

  createReview: shareBaseSchema.extend({
    reviewId: z.uuid("Identifiant de review invalide"),
  }),
};
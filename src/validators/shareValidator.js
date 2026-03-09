"use strict";

import { z } from "zod";

/**
 * Validation des partages
 *
 * @see https://zod.dev
 */
export const schemas = {
  create: z.object({
    item_id: z.string().uuid("Identifiant de pépite invalide"),
    user_id: z.string().uuid("Identifiant de profil invalide"),

    email: z.email("Email du destinataire invalide"),

    message: z
      .string()
      .trim()
      .max(500, "Le message ne peut pas dépasser 500 caractères")
      .optional()
      .or(z.literal("")),
  }),
};

"use strict";

import { z } from "zod";

/**
 * Validation des Tags
 *
 * @see https://zod.dev
 */
export const schemas = {
  create: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Le tag doit contenir au moins 2 caractères")
      .max(50, "Le tag ne peut pas dépasser 50 caractères")
      .regex(/^[a-zA-Z0-9-_ ]+$/, "Le tag contient des caractères invalides"),
  }),
};

"use strict";

import { z } from "zod";

const baseTagSchema = z.object({
  tagName: z
    .string()
    .trim()
    .min(2, "Le tag doit contenir au moins 2 caractères")
    .max(30, "Le tag ne peut pas dépasser 30 caractères"),

  redirectTo: z.string().trim().optional(),
});

export const schemas = {
  create: baseTagSchema,
  update: baseTagSchema.partial(),
};
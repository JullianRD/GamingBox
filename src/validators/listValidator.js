"use strict";

import { z } from "zod";

const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

const listFields = {
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères")
    .max(100, "100 caractères maximum"),
  description: z
    .string()
    .trim()
    .max(500, "500 caractères maximum")
    .optional()
    .transform((v) => v || null),
  isPublic: checkbox,
};

export const schemas = {
  create: z.object(listFields),
  update: z.object(listFields),
  addItem: z.object({
    gameId: z.uuid("Jeu invalide"),
    note: z
      .string()
      .trim()
      .max(300, "300 caractères maximum")
      .optional()
      .transform((v) => v || null),
  }),
};

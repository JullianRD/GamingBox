"use strict";

import { z } from "zod";

/**
 * Validation des Reviews
 *
 * @see https://zod.dev
 */
const boolFromForm = z
  .union([z.boolean(), z.stringbool()])
  .transform((value) => Boolean(value));

const progressionStatusEnum = z.enum(
  ["En cour", "Terminé", "Whislist", "Dropped"],
  { errorMap: () => ({ message: "Statut de progression invalide" }) },
);

const gamePlatformeEnum = z.enum(
  ["PC", "Console de jeu", "Autre"],
  { errorMap: () => ({ message: "Plateforme invalide" }) },
);

const tagIdsSchema = z
  .union([
    z.uuid("Tag invalide"),
    z.array(z.uuid("Tag invalide")),
  ])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional();

const baseReviewSchema = z.object({
  gameId: z.uuid("Identifiant de jeu invalide"),

  reviewTitle: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères")
    .max(100, "Le titre ne peut pas dépasser 100 caractères"),

  reviewRate: z
    .coerce.number()
    .min(0, "La note ne peut pas être négative")
    .max(10, "La note ne peut pas dépasser 10"),

  reviewLike: boolFromForm.default(false),

  reviewPlatine: boolFromForm.default(false),

  progressionStatus: progressionStatusEnum.default("En cour"),

  avisReview: z
    .string()
    .trim()
    .max(1000, "L'avis ne peut pas dépasser 1000 caractères")
    .optional()
    .or(z.literal("")),

  gamePlatforme: gamePlatformeEnum,

  tagIds: tagIdsSchema,
});

const updateTagsSchema = z.object({
  tagIds: tagIdsSchema,
});

export const schemas = {
  create: baseReviewSchema,
  update: baseReviewSchema.partial(),
  updateTags: updateTagsSchema,
};
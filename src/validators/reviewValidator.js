"use strict";

import { z } from "zod";

/**
 * Validation des reviews
 * @see https://zod.dev
 */

/** Case à cocher HTML : absente => false ; "on" / "true" / true => true */
const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true" || value === "1");

const progressionStatusEnum = z.enum(["En cour", "Terminé", "Whislist", "Dropped"], {
  error: "Statut de progression invalide",
});

const gamePlatformeEnum = z.enum(["PC", "Console de jeu", "Autre"], {
  error: "Plateforme invalide",
});

/**
 * tagIds : absent => undefined (ne pas toucher aux tags)
 *          "" / [""] (formulaire sans tag coché) => [] (retirer tous les tags)
 *          "uuid" / ["uuid", ...] => liste dédoublonnée
 */
const tagIdsSchema = z
  .preprocess((value) => {
    if (value === undefined) return undefined;
    const list = Array.isArray(value) ? value : [value];
    return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
  }, z.array(z.uuid("Tag invalide")).max(50, "Trop de tags").optional());

const baseReviewSchema = z.object({
  gameId: z.uuid("Identifiant de jeu invalide"),

  reviewTitle: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères")
    .max(100, "Le titre ne peut pas dépasser 100 caractères"),

  reviewRate: z.coerce
    .number("La note doit être un nombre")
    .min(0, "La note ne peut pas être négative")
    .max(10, "La note ne peut pas dépasser 10"),

  reviewLike: checkbox,
  reviewPlatine: checkbox,
  isPublic: checkbox,

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
  // gameId n'est pas modifiable : une review reste attachée à son jeu
  update: baseReviewSchema.omit({ gameId: true }),
  updateTags: updateTagsSchema,
};

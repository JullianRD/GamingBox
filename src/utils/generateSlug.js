"use strict";

/**
 * Transforme un titre en slug d'URL : minuscules, sans accents, tirets.
 * « Pokémon : Édition Rouge ! » -> « pokemon-edition-rouge »
 * Retourne une chaîne vide si le titre ne contient aucun caractère latin/chiffre.
 */
export const generateSlug = (title) =>
  String(title ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/_/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

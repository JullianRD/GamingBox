// src/utils/generateSlug.js
"use strict";
export const generateSlug = (title) => {
  const slugifyTitle = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+ | -+$/g, "");

  return slugifyTitle;
};

// De ce que je comprend on fait un regex pour faire la mise en forme des texte inséré par l'utilisateur (genre les titres des reviews)
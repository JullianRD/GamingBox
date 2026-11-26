// src/utils/generateSlug.js
"use strict";
export const generateSlug = (title) => {
  const slugifyTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents : « préférés » -> « preferes »
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slugifyTitle;
};

// De ce que je comprend on fait un regex pour faire la mise en forme des texte inséré par l'utilisateur (genre les titres des reviews)
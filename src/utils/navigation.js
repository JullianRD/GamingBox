"use strict";

import { ITEM_TYPES } from "./itemTypes.js";

const libraryPrefixes = [
  "/bibliotheque",
  "/tags",
  "/entrees",
  "/ajouter",
  ...Object.values(ITEM_TYPES).map((t) => t.path),
];

// Entrées de navigation communes à l'en-tête et à la barre d'onglets mobile
export const navItemsFor = (path) =>
  [
    { href: "/", label: "Accueil", match: (p) => p === "/" },
    {
      href: "/bibliotheque",
      label: "Bibliothèque",
      short: "Biblio",
      match: (p) => libraryPrefixes.some((x) => p.startsWith(x)),
    },
    { href: "/fil", label: "Fil", match: (p) => p.startsWith("/fil") || p.startsWith("/amis") },
    { href: "/listes", label: "Listes", match: (p) => p.startsWith("/listes") },
    { href: "/defis", label: "Défis", match: (p) => p.startsWith("/defis") },
  ].map(({ match, ...item }) => ({ ...item, active: match(path) }));

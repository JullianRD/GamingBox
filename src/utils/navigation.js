"use strict";

import { ITEM_TYPES } from "./itemTypes.js";

const libraryPrefixes = [
  "/bibliotheque",
  "/tags",
  "/entrees",
  "/ajouter",
  ...Object.values(ITEM_TYPES).map((t) => t.path),
];

// Tracés des icônes (trait 1.8, 24×24), partagés par la barre latérale et les onglets
export const NAV_ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  library: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="m14.5 5.5 3.5-.9 3 14.6-3.5.8z"/>',
  discover: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  feed: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  lists: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  challenges: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  import: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  inbox: '<path d="M4 7h16v11H4z"/><path d="m4 8 8 6 8-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  admin: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>',
};

// Entrées de navigation communes à la barre latérale (ordinateur) et aux onglets (mobile)
export const navItemsFor = (path) =>
  [
    { href: "/", label: "Accueil", icon: "home", match: (p) => p === "/" },
    {
      href: "/bibliotheque",
      label: "Bibliothèque",
      short: "Biblio",
      icon: "library",
      match: (p) => libraryPrefixes.some((x) => p.startsWith(x)),
    },
    { href: "/decouvrir", label: "Découvrir", icon: "discover", tabbar: false, match: (p) => p.startsWith("/decouvrir") || p.startsWith("/recommandations") },
    { href: "/fil", label: "Fil", icon: "feed", match: (p) => p.startsWith("/fil") || p.startsWith("/amis") },
    { href: "/listes", label: "Listes", icon: "lists", tabbar: false, match: (p) => p.startsWith("/listes") },
    { href: "/defis", label: "Défis", icon: "challenges", match: (p) => p.startsWith("/defis") },
  ].map(({ match, ...item }) => ({ ...item, active: match(path) }));

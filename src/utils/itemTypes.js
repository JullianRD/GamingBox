"use strict";

/**
 * Types d'éléments suivis dans Cocon et leurs libellés.
 * Source unique pour les vues (couleurs de section, statuts, routes).
 */

export const STATUSES = ["planned", "in_progress", "completed", "paused", "dropped"];

export const ITEM_TYPES = {
  game: {
    code: "game",
    label: "Jeu",
    plural: "Jeux",
    path: "/jeux",
    enabled: true,
    tone: { chip: "bg-games text-games-ink", cover: "bg-games-cover", ink: "text-games-ink" },
    statusLabels: {
      planned: "À jouer",
      in_progress: "En cours",
      completed: "Terminé",
      paused: "En pause",
      dropped: "Abandonné",
    },
  },
  movie: {
    code: "movie",
    label: "Film",
    plural: "Films",
    path: "/films",
    enabled: true,
    tone: { chip: "bg-movies text-movies-ink", cover: "bg-movies-cover", ink: "text-movies-ink" },
    statusLabels: {
      planned: "À voir",
      in_progress: "En cours",
      completed: "Vu",
      paused: "En pause",
      dropped: "Abandonné",
    },
  },
  book: {
    code: "book",
    label: "Livre",
    plural: "Livres",
    path: "/livres",
    enabled: false,
    tone: { chip: "bg-books text-books-ink", cover: "bg-books-cover", ink: "text-books-ink" },
    statusLabels: {
      planned: "À lire",
      in_progress: "En cours",
      completed: "Lu",
      paused: "En pause",
      dropped: "Abandonné",
    },
  },
};

export const getItemType = (code) => ITEM_TYPES[code] ?? null;

export const getItemTypeByPath = (path) =>
  Object.values(ITEM_TYPES).find((type) => type.path === path) ?? null;

export const statusLabel = (typeCode, status) =>
  getItemType(typeCode)?.statusLabels[status] ?? status;

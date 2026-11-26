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
    enabled: true,
    tone: { chip: "bg-books text-books-ink", cover: "bg-books-cover", ink: "text-books-ink" },
    statusLabels: {
      planned: "À lire",
      in_progress: "En cours",
      completed: "Lu",
      paused: "En pause",
      dropped: "Abandonné",
    },
  },
  series: {
    code: "series",
    label: "Série",
    plural: "Séries",
    path: "/series",
    enabled: true,
    tone: { chip: "bg-series text-series-ink", cover: "bg-series-cover", ink: "text-series-ink" },
    statusLabels: {
      planned: "À voir",
      in_progress: "En cours",
      completed: "Vue",
      paused: "En pause",
      dropped: "Abandonnée",
    },
  },
  anime: {
    code: "anime",
    label: "Anime",
    plural: "Anime",
    path: "/anime",
    enabled: true,
    tone: { chip: "bg-anime text-anime-ink", cover: "bg-anime-cover", ink: "text-anime-ink" },
    statusLabels: {
      planned: "À voir",
      in_progress: "En cours",
      completed: "Vu",
      paused: "En pause",
      dropped: "Abandonné",
    },
  },
  manga: {
    code: "manga",
    label: "Manga",
    plural: "Manga",
    path: "/manga",
    enabled: true,
    tone: { chip: "bg-anime text-anime-ink", cover: "bg-anime-cover", ink: "text-anime-ink" },
    statusLabels: {
      planned: "À lire",
      in_progress: "En cours",
      completed: "Lu",
      paused: "En pause",
      dropped: "Abandonné",
    },
  },
  music: {
    code: "music",
    label: "Musique",
    plural: "Musique",
    path: "/musique",
    enabled: true,
    tone: { chip: "bg-music text-music-ink", cover: "bg-music-cover", ink: "text-music-ink" },
    statusLabels: {
      planned: "À écouter",
      in_progress: "En écoute",
      completed: "Écouté",
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

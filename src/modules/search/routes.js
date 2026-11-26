"use strict";

import { Router } from "express";
import IgdbService from "../../services/IgdbService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { logger } from "../../config/logger.js";
import SocialService from "../social/SocialService.js";

const router = Router();

const MIN_LENGTH = 2;

// Résultats de recherche (jeux via IGDB pour l'instant, films via TMDB à l'étape 7)
const searchAll = async (query) => {
  if (query.length < MIN_LENGTH) return { results: [], error: null };
  try {
    const games = await IgdbService.searchGames(query);
    return {
      results: games.map((game) => ({
        type: "game",
        title: game.gameTitle,
        coverUrl: game.thumbnailUrl,
        meta: [game.releaseDate?.slice(0, 4), game.gameGenre].filter(Boolean).join(" · "),
        href: `/ajouter/igdb/${game.igdbId}`,
      })),
      error: null,
    };
  } catch (error) {
    logger.warn({ err: error }, "Recherche IGDB indisponible");
    return { results: [], error: "La recherche de jeux est indisponible pour le moment." };
  }
};

router.get("/recherche", requireAuth, async (req, res) => {
  const query = String(req.query.q || "").trim();
  const [{ results, error }, people] = await Promise.all([
    searchAll(query),
    query.length >= MIN_LENGTH ? SocialService.searchUsers(query, req.session.userId) : [],
  ]);
  const view = req.get("HX-Request") ? "partials/search/results" : "pages/search/index";

  res.render(view, {
    title: "Recherche - Cocon",
    searchQuery: query,
    results,
    people,
    error,
    minLength: MIN_LENGTH,
    layout: req.get("HX-Request") ? false : undefined,
  });
});

export default router;

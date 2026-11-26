"use strict";

import { z } from "zod";
import GameService from "../services/GameService.js";
import { AppError } from "../utils/AppError.js";

const searchSchema = z.object({ q: z.string().trim().max(100).default("") });
const importSchema = z.object({ igdbId: z.coerce.number().int().positive() });

/**
 * Jeux : recherche et import depuis IGDB (API JSON consommée par le formulaire de review).
 * La gestion globale des jeux (liste, suppression) est dans l'espace admin.
 */
class GameController {
  async searchIgdb(req, res) {
    const { q } = searchSchema.parse(req.query);
    const games = await GameService.searchIgdbGames(q);
    return res.json({ games });
  }

  async importFromIgdb(req, res) {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.badRequest("igdbId requis (entier positif).");

    const result = await GameService.getOrCreateByIgdbId(parsed.data.igdbId);
    return res.json({ success: true, game: result.game, created: result.created });
  }
}

export default new GameController();

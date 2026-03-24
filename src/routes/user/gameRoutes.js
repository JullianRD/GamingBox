"use strict";

import { Router } from "express";
import GameController from "../../controller/GameController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";

// Routes pour les jeux en base locale + import IGDB

const router = Router();

// Routes accessibles aux utilisateurs connectés pour la recherche/import IGDB
router.use(requireAuth);

// Recherche de jeux via IGDB
router.get("/games/search/igdb", GameController.searchIgdb);

// Import d'un jeu depuis IGDB vers la base locale
router.post("/games/import/igdb", GameController.importFromIgdb);

// Routes admin pour la gestion locale
router.get("/games", requireAdmin, GameController.index);

// Détails d'un jeu en base
router.get("/games/:id", requireAdmin, GameController.show);

// Création d'un jeu en base local
router.post("/games", requireAdmin, GameController.store);

// Formulaire d'édition du jeu
router.get("/games/:id/edit", requireAdmin, GameController.edit);

// Mise à jour du jeu dans la base
router.post("/games/:id", requireAdmin, GameController.update);

// Suppression du jeu dans la base
router.post("/games/:id/delete", requireAdmin, GameController.destroy);

export default router;
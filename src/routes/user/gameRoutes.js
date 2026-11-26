"use strict";

import { Router } from "express";
import GameController from "../../controller/GameController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { igdbLimiter } from "../../config/security.js";

const router = Router();

router.use("/games", requireAuth);

// Réponses JSON (y compris les erreurs)
router.use("/games", (req, _res, next) => {
  req.forceJson = true;
  next();
});

// Recherche et import depuis IGDB (quota externe : limité par utilisateur)
router.get("/games/search/igdb", igdbLimiter, GameController.searchIgdb);
router.post("/games/import/igdb", igdbLimiter, GameController.importFromIgdb);

// Gestion des jeux = espace admin
router.get("/games", (req, res) => res.redirect("/admin/games"));

export default router;

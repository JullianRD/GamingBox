"use strict"

import { Router } from "express";
import GameController from "../../controller/GameController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";





// Routes pour les jeux en base local / Réservé aux admins

const router = Router();

// Il faut être connecté et être admin pour accéder à ces routes
router.use(requireAuth);
router.use(requireAdmin);


// Liste des jeux présent en base 
router.get("/games", GameController.index);

// Détails d'un jeu en base
router.get("/games/:id", GameController.show);

// Création d'un jeu en base local (plutôt le stockage via IGDB)
router.post("/games", GameController.store)

// Formulaire d'édition du jeu
router.get("/games/:id/edit", GameController.edit)

// Mise à jour du jeu dans la base
router.post("/games", GameController.update);

// Suppression du jeu dans la base
router.post("/games", GameController.destroy);

export default router;
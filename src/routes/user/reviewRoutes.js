"use strict";

import { Router } from "express";
import ReviewController from "../../controller/ReviewController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as reviewSchemas } from "../../validators/reviewValidator.js";


const router = Router(); // Créer un objet grâce à express qui contiens toutes les routes lié aux reviews

// Routes pour les reviews (l'utilisateur doit être connecté à son compte)

router.use(requireAuth)

// Liste des reviews (la page principal avec le feed des reviews de l'utilisateur)
router.get("/reviews", ReviewController.index);

// Formulaire de création de la review
router.get("/reviews/new", ReviewController.new);

// Création d'une nouvelle review
router.post("reviews", validate(reviewSchemas.create), ReviewController.store);

// Formulaire d'édition de la review
router.get("/reviews/:id/edit", ReviewController.edit);

// Mise à jour de la review
router.post("/reviews/:id", validate(reviewSchemas.create), ReviewController.update);

// Afficher les détails d'une review 
router.get("reviews/;id", ReviewController.show);

// Suppression d'une review
router.post("reviews/:id/delete", ReviewController.destroy)

export default router;
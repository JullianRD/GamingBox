"use strict";

import { Router } from "express";
import ShareController from "../../controller/ShareController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as shareSchemas } from "../../validators/shareValidator.js";

const router = Router();

// Accès public (lien secret reçu par email)
router.get("/shares/access/:token", ShareController.access);

// Gestion des partages : utilisateur connecté
router.use("/shares", requireAuth);

router.get("/shares", ShareController.index);
router.get("/shares/new/profile", ShareController.newForProfile);
router.get("/shares/new/review", ShareController.newForReview);

router.post(
  "/shares/profile",
  validate(shareSchemas.createProfile, { fallback: "/shares/new/profile" }),
  ShareController.storeForProfile,
);
router.post(
  "/shares/review",
  validate(shareSchemas.createReview, { fallback: "/shares" }),
  ShareController.storeForReview,
);
router.post("/shares/:id/delete", ShareController.destroy);

export default router;

"use strict";

import { Router } from "express";
import ReviewController from "../../controller/ReviewController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as reviewSchemas } from "../../validators/reviewValidator.js";

const router = Router();

// Reviews : l'utilisateur doit être connecté (le CSRF est vérifié globalement)
router.use("/reviews", requireAuth);

router.get("/reviews", ReviewController.index);
router.get("/reviews/new", ReviewController.new);
router.post(
  "/reviews",
  validate(reviewSchemas.create, { fallback: "/reviews/new" }),
  ReviewController.store,
);

router.get("/reviews/:slug/edit", ReviewController.edit);
router.post(
  "/reviews/:slug",
  validate(reviewSchemas.update),
  ReviewController.update,
);
router.post(
  "/reviews/:slug/tags",
  validate(reviewSchemas.updateTags),
  ReviewController.updateTags,
);
router.get("/reviews/:slug", ReviewController.show);
router.post("/reviews/:slug/delete", ReviewController.destroy);

export default router;

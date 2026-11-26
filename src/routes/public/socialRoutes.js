"use strict";

import { Router } from "express";
import SocialController from "../../controller/SocialController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";

const router = Router();

// Pages publiques (profil public requis, sinon 404)
router.get("/u/:pseudo", SocialController.profile);
router.get("/u/:pseudo/reviews/:slug", SocialController.review);
router.get("/u/:pseudo/lists/:slug", SocialController.list);

// Actions connectées
router.post("/u/:pseudo/follow", requireAuth, SocialController.follow);
router.post("/u/:pseudo/unfollow", requireAuth, SocialController.unfollow);
router.post("/u/:pseudo/reviews/:slug/like", requireAuth, SocialController.like);
router.get("/feed", requireAuth, SocialController.feed);

export default router;

"use strict";

import { Router } from "express";
import DiscoverService from "./DiscoverService.js";
import RecommendationService from "./RecommendationService.js";
import SocialService from "../social/SocialService.js";
import UserItemRepository from "../library/UserItemRepository.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";

const router = Router();
router.use(["/decouvrir", "/recommandations", "/entrees/:id/recommander"], requireAuth);

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Page Découvrir : sélection du jour (toutes catégories) ou une catégorie avec ses tendances
router.get(
  "/decouvrir",
  wrap(async (req, res) => {
    const type = ITEM_TYPES[req.query.type]?.enabled ? req.query.type : null;
    const userId = req.session.userId;
    const [daily, trends] = await Promise.all([
      DiscoverService.getDailyPicks(userId, { types: type ? [type] : null }),
      type ? DiscoverService.getTrends(type) : null,
    ]);
    res.render("pages/discover/index", {
      title: "Découvrir - Cocon",
      section: type,
      currentType: type,
      daily,
      trends,
      coconTrends: type ? null : (await DiscoverService.getTrends(null)).cocon,
    });
  }),
);

// Bloc « Pour toi aujourd'hui » de l'accueil, chargé après la page (les API peuvent être lentes)
router.get(
  "/decouvrir/du-jour",
  wrap(async (req, res) => {
    // Sans catégorie : la meilleure suggestion de chaque catégorie ; avec : celles de la catégorie
    const type = ITEM_TYPES[req.query.type]?.enabled ? req.query.type : null;
    const all = await DiscoverService.getDailyPicks(req.session.userId);
    const picks = type ? all.find((d) => d.type.code === type)?.picks ?? [] : all.map((d) => d.picks[0]).filter(Boolean);
    res.render("partials/discover/today", { layout: false, picks, currentType: type, types: all.map((d) => d.type) });
  }),
);

router.get(
  "/recommandations",
  wrap(async (req, res) => {
    const userId = req.session.userId;
    const inbox = await RecommendationService.inbox(userId);
    await RecommendationService.markAllSeen(userId);
    res.locals.unseenRecommendations = 0;
    res.render("pages/discover/inbox", { title: "Recommandations - Cocon", inbox });
  }),
);

router.post(
  "/recommandations/:recoId/supprimer",
  requireUuidParams("recoId"),
  doubleCsrfProtection,
  wrap(async (req, res) => {
    await RecommendationService.remove(req.session.userId, req.params.recoId);
    if (req.get("HX-Request")) return res.send("");
    res.redirect("/recommandations");
  }),
);

router.post(
  "/entrees/:id/recommander",
  requireUuidParams("id"),
  doubleCsrfProtection,
  wrap(async (req, res) => {
    const userId = req.session.userId;
    let sent = [];
    let error = null;
    try {
      sent = await RecommendationService.send(userId, req.params.id, req.body.friends, req.body.message);
    } catch (e) {
      if (!e.statusCode || e.statusCode >= 500 || e.statusCode === 404) throw e;
      error = e.message;
    }
    if (!req.get("HX-Request")) {
      req.flash(error ? "error" : "success", error ?? `Recommandé à ${sent.map((f) => f.pseudo).join(", ")}.`);
      return res.redirect(`/entrees/${req.params.id}`);
    }
    const entry = await UserItemRepository.findByIdForUser(req.params.id, userId);
    const [friends, alreadySent] = await Promise.all([
      SocialService.getFriends(userId),
      RecommendationService.sentFor(userId, entry.itemId),
    ]);
    res.render("partials/discover/recommend", { layout: false, entry, friends, alreadySent, sent, error });
  }),
);

export default router;

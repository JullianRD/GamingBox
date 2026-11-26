"use strict";

import { Router } from "express";
import SocialService from "./SocialService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

const router = Router();
router.use(["/u", "/fil", "/amis", "/commentaires"], requireAuth);

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const isHtmx = (req) => Boolean(req.get("HX-Request"));

// Profil public
router.get(
  "/u/:pseudo",
  wrap(async (req, res) => {
    const data = await SocialService.getProfile(req.params.pseudo, req.session.userId);
    res.render("pages/social/profile", { title: `${data.profile.pseudo} - Cocon`, ...data });
  }),
);

router.post(
  "/u/:pseudo/suivre",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    const { profile, relation } = await SocialService.toggleFollow(req.session.userId, req.params.pseudo);
    if (!isHtmx(req)) return res.redirect(profile.href);
    res.render("partials/social/follow-button", { profile, relation, layout: false });
  }),
);

router.get(
  "/u/:pseudo/listes/:slug",
  wrap(async (req, res) => {
    const { owner, list, items } = await SocialService.getPublicList(
      req.params.pseudo,
      req.params.slug,
      req.session.userId,
    );
    if (owner.id === req.session.userId) return res.redirect(list.href);
    res.render("pages/lists/public", {
      title: `${list.title} - Cocon`,
      section: list.type,
      owner,
      list,
      items,
    });
  }),
);

// Amis, abonnements et abonnés
router.get(
  "/amis",
  wrap(async (req, res) => {
    const connections = await SocialService.getConnections(req.session.userId);
    res.render("pages/social/connections", { title: "Amis - Cocon", ...connections });
  }),
);

// Fil d'activité, paginé par date (htmx « Voir plus »)
router.get(
  "/fil",
  wrap(async (req, res) => {
    const activities = await SocialService.getFeed(req.session.userId, req.query.avant);
    const locals = {
      title: "Fil - Cocon",
      activities,
      nextCursor: activities.length === 30 ? activities.at(-1).createdAt.toISOString() : null,
    };
    if (isHtmx(req) && req.query.avant)
      return res.render("partials/social/feed-items", { ...locals, layout: false });
    res.render("pages/social/feed", locals);
  }),
);

// Commentaires sous une entrée
router.post(
  "/entrees/:id/commentaires",
  requireAuth,
  requireUuidParams("id"),
  doubleCsrfProtection,
  wrap(async (req, res) => {
    try {
      const { ownerId, comments } = await SocialService.addComment(
        req.params.id,
        req.session.userId,
        req.body.body,
      );
      if (!isHtmx(req)) return res.redirect(`/entrees/${req.params.id}#commentaires`);
      res.render("partials/social/comments", { entryId: req.params.id, ownerId, comments, layout: false });
    } catch (error) {
      if (error.statusCode !== 400 || !isHtmx(req)) throw error;
      res.set("HX-Retarget", "#comment-error").set("HX-Reswap", "innerHTML").send(error.message);
    }
  }),
);

router.post(
  "/commentaires/:id/supprimer",
  requireUuidParams("id"),
  doubleCsrfProtection,
  wrap(async (req, res) => {
    const { entryId, ownerId, comments } = await SocialService.deleteComment(
      req.params.id,
      req.session.userId,
    );
    if (!isHtmx(req)) return res.redirect(`/entrees/${entryId}#commentaires`);
    res.render("partials/social/comments", { entryId, ownerId, comments, layout: false });
  }),
);

export default router;

"use strict";

import { Router } from "express";
import ListService from "./ListService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

const router = Router();
router.use(["/listes", "/entrees/:id/listes"], requireAuth);

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Favoris et listes perso
router.get(
  "/listes",
  wrap(async (req, res) => {
    const userId = req.session.userId;
    const [favorites, lists] = await Promise.all([
      ListService.getFavorites(userId),
      ListService.getLists(userId),
    ]);
    res.render("pages/lists/index", { title: "Mes listes - Cocon", favorites, lists });
  }),
);

router.post(
  "/listes",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    try {
      const list = await ListService.create(req.session.userId, req.body);
      res.redirect(list.href);
    } catch (error) {
      if (error.statusCode !== 400) throw error;
      req.flash("error", error.message);
      res.redirect("/listes");
    }
  }),
);

router.get(
  "/listes/:slug",
  wrap(async (req, res) => {
    const { list, items } = await ListService.getList(req.session.userId, req.params.slug);
    res.render("pages/lists/show", { title: `${list.title} - Cocon`, section: list.type, list, items });
  }),
);

router.post(
  "/listes/:slug/supprimer",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    const list = await ListService.remove(req.session.userId, req.params.slug);
    req.flash("success", `La liste « ${list.title} » a été supprimée.`);
    res.redirect("/listes");
  }),
);

router.post(
  "/listes/:slug/elements/:itemId/retirer",
  requireUuidParams("itemId"),
  doubleCsrfProtection,
  wrap(async (req, res) => {
    const list = await ListService.removeItem(req.session.userId, req.params.slug, req.params.itemId);
    res.redirect(list.href);
  }),
);

// Depuis la fiche : ajoute ou retire l'œuvre d'une liste
router.post(
  "/entrees/:id/listes/:listId",
  requireUuidParams("id", "listId"),
  doubleCsrfProtection,
  wrap(async (req, res) => {
    const { entry, lists } = await ListService.toggleEntryInList(
      req.session.userId,
      req.params.id,
      req.params.listId,
    );
    if (!req.get("HX-Request")) return res.redirect(entry.href);
    res.render("partials/entries/lists", { entry, lists, layout: false });
  }),
);

export default router;

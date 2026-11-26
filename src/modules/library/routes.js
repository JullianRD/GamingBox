"use strict";

import { Router } from "express";
import LibraryController from "./LibraryController.js";
import EntryController from "./EntryController.js";
import UserItemRepository from "./UserItemRepository.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

const router = Router();

router.get("/", LibraryController.home);
router.get("/bibliotheque", requireAuth, LibraryController.library);
router.get(
  Object.values(ITEM_TYPES).map((type) => type.path),
  requireAuth,
  LibraryController.section,
);

// Ajout depuis la recherche : aperçu puis création de l'entrée
router.get("/ajouter/:source/:externalId", requireAuth, EntryController.preview);
router.post("/entrees", requireAuth, doubleCsrfProtection, EntryController.create);

// Fiche d'une entrée et ses actions (htmx)
const validIds = requireUuidParams("id", "tagId", "entityId");
router.get("/entrees/:id", requireAuth, validIds, EntryController.show);
router.get("/entrees/:id/personnages", requireAuth, validIds, EntryController.characters);

const entryActions = Router({ mergeParams: true });
entryActions.use(requireAuth, doubleCsrfProtection);
const guard = (handler) => [validIds, handler];
entryActions.post("/statut", ...guard(EntryController.updateStatus));
entryActions.post("/note", ...guard(EntryController.updateRating));
entryActions.post("/avis", ...guard(EntryController.updateReview));
entryActions.post("/favori", ...guard(EntryController.toggleFavorite));
entryActions.post("/tags", ...guard(EntryController.addTag));
entryActions.post("/tags/:tagId/retirer", ...guard(EntryController.removeTag));
entryActions.post("/personnages/:entityId/favori", ...guard(EntryController.toggleCharacter));
entryActions.post("/supprimer", ...guard(EntryController.destroy));
router.use("/entrees/:id", entryActions);

// Tags : vue d'ensemble et entrées par tag
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.get(
  "/tags",
  requireAuth,
  wrap(async (req, res) => {
    const tags = await UserItemRepository.findTags(req.session.userId);
    res.render("pages/library/tags", { title: "Mes tags - Cocon", tags });
  }),
);
router.get(
  "/tags/:tagId",
  requireAuth,
  validIds,
  wrap(async (req, res, next) => {
    const tags = await UserItemRepository.findTags(req.session.userId);
    const tag = tags.find((t) => t.id === req.params.tagId);
    if (!tag) return next();
    const entries = await UserItemRepository.findByTag(req.session.userId, tag.id);
    res.render("pages/library/tag", { title: `${tag.name} - Cocon`, tag, entries });
  }),
);
router.post(
  "/tags/:tagId/supprimer",
  requireAuth,
  validIds,
  doubleCsrfProtection,
  wrap(async (req, res) => {
    await UserItemRepository.deleteTag(req.session.userId, req.params.tagId);
    req.flash("success", "Tag supprimé.");
    res.redirect("/tags");
  }),
);

// Les anciennes pages de reviews renvoient vers la section Jeux
router.get(/^\/(reviews|shares|games)(\/.*)?$/, requireAuth, (req, res) => res.redirect(301, "/jeux"));

export default router;

"use strict";

import { Router } from "express";
import LibraryController from "./LibraryController.js";
import EntryController from "./EntryController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

const router = Router();

router.get("/", LibraryController.home);
router.get(["/jeux", "/films"], requireAuth, LibraryController.section);

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

// Les anciennes pages de reviews renvoient vers la section Jeux
router.get(/^\/reviews(\/.*)?$/, requireAuth, (req, res) => res.redirect(301, "/jeux"));

export default router;

"use strict";

import LibraryService from "./LibraryService.js";
import ListService from "../lists/ListService.js";

const isHtmx = (req) => Boolean(req.get("HX-Request"));

// Requête htmx : on renvoie le composant à jour ; sinon retour à la fiche
const respond = (req, res, view, locals, fallbackUrl) => {
  if (isHtmx(req)) return res.render(view, { ...locals, layout: false });
  return res.redirect(fallbackUrl);
};

// Message d'erreur lisible dans la fiche (htmx) ; le reste suit le flux normal
const handle = (action) => async (req, res, next) => {
  try {
    await action(req, res);
  } catch (error) {
    if (isHtmx(req) && error.statusCode === 400) {
      res.set("HX-Retarget", "#entry-error").set("HX-Reswap", "innerHTML");
      return res.status(200).send(error.message);
    }
    next(error);
  }
};

class EntryController {
  // Aperçu avant ajout (depuis la recherche)
  preview = handle(async (req, res) => {
    const { source, externalId } = req.params;
    const { item, entry } = await LibraryService.preview(req.session.userId, source, externalId);
    if (entry) return res.redirect(entry.href);
    res.render("pages/entries/preview", { title: `${item.title} - Cocon`, section: item.type, item });
  });

  create = handle(async (req, res) => {
    const { source, externalId, status } = req.body;
    const entryId = await LibraryService.add(req.session.userId, source, externalId, { status });
    res.redirect(`/entrees/${entryId}`);
  });

  show = handle(async (req, res) => {
    const userId = req.session.userId;
    const entry = await LibraryService.getEntry(req.params.id, userId);
    const lists = await ListService.getListsForItem(userId, entry.itemId);
    res.render("pages/entries/show", { title: `${entry.title} - Cocon`, section: entry.type, entry, lists });
  });

  updateStatus = handle(async (req, res) => {
    const entry = await LibraryService.update(req.params.id, req.session.userId, { status: req.body.status });
    respond(
      req,
      res,
      "components/status-pills",
      { type: entry.type, current: entry.status, action: `${entry.href}/statut` },
      entry.href,
    );
  });

  updateRating = handle(async (req, res) => {
    const current = await LibraryService.getEntry(req.params.id, req.session.userId);
    // Un clic sur la note déjà donnée l'efface
    const rating = Number(req.body.rating) === current.rating ? "" : req.body.rating;
    const entry = await LibraryService.update(current.id, req.session.userId, { rating });
    respond(
      req,
      res,
      "components/rating-stars",
      { value: entry.rating, action: `${entry.href}/note` },
      entry.href,
    );
  });

  updateReview = handle(async (req, res) => {
    const entry = await LibraryService.update(req.params.id, req.session.userId, { review: req.body.review });
    respond(req, res, "partials/entries/review", { entry, saved: true }, entry.href);
  });

  toggleFavorite = handle(async (req, res) => {
    const entry = await LibraryService.toggleFavorite(req.params.id, req.session.userId);
    respond(req, res, "partials/entries/favorite", { entry }, entry.href);
  });

  addTag = handle(async (req, res) => {
    const entry = await LibraryService.addTag(req.params.id, req.session.userId, req.body.tagName);
    respond(req, res, "partials/entries/tags", { entry }, entry.href);
  });

  removeTag = handle(async (req, res) => {
    const entry = await LibraryService.removeTag(req.params.id, req.session.userId, req.params.tagId);
    respond(req, res, "partials/entries/tags", { entry }, entry.href);
  });

  characters = handle(async (req, res) => {
    const data = await LibraryService.getCharacters(req.params.id, req.session.userId);
    res.render("partials/entries/characters", { ...data, layout: false });
  });

  toggleCharacter = handle(async (req, res) => {
    const { entry, entity } = await LibraryService.toggleFavoriteCharacter(
      req.params.id,
      req.session.userId,
      req.params.entityId,
    );
    respond(req, res, "partials/entries/character", { entry, entity }, entry.href);
  });

  destroy = handle(async (req, res) => {
    const entry = await LibraryService.getEntry(req.params.id, req.session.userId);
    await LibraryService.remove(entry.id, req.session.userId);
    req.flash("success", `${entry.title} a été retiré de ta bibliothèque.`);
    res.redirect(res.locals.itemTypes[entry.type]?.path ?? "/");
  });
}

export default new EntryController();

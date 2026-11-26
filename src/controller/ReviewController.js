"use strict";

import { z } from "zod";
import ReviewService from "../services/ReviewService.js";
import GameService from "../services/GameService.js";
import TagService from "../services/TagService.js";
import { isAdminRole } from "../middlewares/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  tag: z.uuid().optional().catch(undefined),
  status: z.enum(["En cour", "Terminé", "Whislist", "Dropped"]).optional().catch(undefined),
  platform: z.enum(["PC", "Console de jeu", "Autre"]).optional().catch(undefined),
  sort: z.enum(["recent", "oldest", "rating", "title"]).optional().catch(undefined),
  minRate: z.coerce.number().min(0).max(10).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).optional().catch(undefined),
});

/** Les comptes admin gèrent la plateforme, pas de bibliothèque personnelle. */
const redirectAdmin = (req, res) => {
  if (isAdminRole(req.session.roleName)) {
    res.redirect("/admin");
    return true;
  }
  return false;
};

class ReviewController {
  // Liste paginée de mes reviews, avec recherche et filtres
  async index(req, res) {
    if (redirectAdmin(req, res)) return;

    const userId = req.session.userId;
    const query = listQuerySchema.parse(req.query);

    const [result, tags] = await Promise.all([
      ReviewService.search(userId, {
        q: query.q || undefined,
        tagId: query.tag,
        status: query.status,
        platform: query.platform,
        sort: query.sort,
        minRate: query.minRate,
        page: query.page,
      }),
      TagService.findByUserId(userId),
    ]);

    const selectedTag = query.tag ? tags.find((tag) => tag.id === query.tag) || null : null;

    return res.render("pages/reviews/index", {
      title: "Mes reviews - GamingBox",
      reviews: result.items,
      pagination: { page: result.page, totalPages: result.totalPages, total: result.total },
      filters: query,
      tags: tags || [],
      selectedTagId: query.tag || null,
      selectedTag,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  // Détails d'une review
  async show(req, res) {
    if (redirectAdmin(req, res)) return;

    const userId = req.session.userId;
    const review = await ReviewService.findBySlug(req.params.slug, userId);
    if (!review) throw AppError.notFound("Review introuvable.");

    const [tags, availableTags] = await Promise.all([
      ReviewService.getTagsByReviewId(review.id),
      TagService.findByUserId(userId),
    ]);

    return res.render("pages/reviews/show", {
      title: "Détail de la review - GamingBox",
      review,
      tags: tags || [],
      availableTags: availableTags || [],
      selectedTagIds: (tags || []).map((tag) => tag.id),
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  // Formulaire de création
  async new(req, res) {
    if (redirectAdmin(req, res)) return;

    const [games, tags] = await Promise.all([
      GameService.findAllByGameId(),
      TagService.findByUserId(req.session.userId),
    ]);

    return res.render("pages/reviews/new", {
      title: "Nouvelle review - GamingBox",
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
      games: games || [],
      tags: tags || [],
    });
  }

  async store(req, res) {
    if (redirectAdmin(req, res)) return;

    try {
      await ReviewService.create(req.session.userId, req.body.gameId, req.body);
      req.flash("success", "Review enregistrée avec succès");
      return res.redirect("/reviews");
    } catch (error) {
      if (!error?.isOperational) throw error;
      req.flash("error", error.message);
      return res.redirect("/reviews/new");
    }
  }

  async edit(req, res) {
    if (redirectAdmin(req, res)) return;

    const userId = req.session.userId;
    const review = await ReviewService.findBySlug(req.params.slug, userId);
    if (!review) throw AppError.notFound("Review introuvable.");

    const [tags, reviewTags] = await Promise.all([
      TagService.findByUserId(userId),
      ReviewService.getTagsByReviewId(review.id),
    ]);

    return res.render("pages/reviews/edit", {
      title: "Modifier la review - GamingBox",
      review,
      tags: tags || [],
      selectedTagIds: (reviewTags || []).map((tag) => tag.id),
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async update(req, res) {
    if (redirectAdmin(req, res)) return;

    try {
      await ReviewService.update(req.session.userId, req.params.slug, req.body);
      req.flash("success", "La review a bien été mise à jour");
      return res.redirect("/reviews");
    } catch (error) {
      if (!error?.isOperational || error.statusCode === 404) throw error;
      req.flash("error", error.message);
      return res.redirect(`/reviews/${encodeURIComponent(req.params.slug)}/edit`);
    }
  }

  async updateTags(req, res) {
    if (redirectAdmin(req, res)) return;

    await ReviewService.replaceTagsBySlug(req.session.userId, req.params.slug, req.body.tagIds);
    req.flash("success", "Les tags de la review ont bien été mis à jour");
    return res.redirect(`/reviews/${encodeURIComponent(req.params.slug)}`);
  }

  async destroy(req, res) {
    if (redirectAdmin(req, res)) return;

    await ReviewService.deleteReview(req.session.userId, req.params.slug);
    req.flash("success", "La review a bien été supprimée");
    return res.redirect("/reviews");
  }
}

export default new ReviewController();

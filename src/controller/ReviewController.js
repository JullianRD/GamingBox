"use strict";

import ReviewService from "../services/ReviewService.js";
import GameService from "../services/GameService.js";
import TagService from "../services/TagService.js";
import { generateToken } from "../config/security.js";

/**
 * reviewController
 *
 * Gestion HTTP des Reviews
 */
class ReviewController {
  /**
   * Liste de toutes les reviews d'un utilisateur
   */
  async index(req, res) {
    try {
      const userId = req.session.userId;
      const rawTagId = req.query.tag;

      const selectedTagId =
        rawTagId && rawTagId !== "null" && rawTagId !== "undefined"
          ? rawTagId
          : null;

      const reviews = selectedTagId
        ? await ReviewService.findAllByUserAndTag(userId, selectedTagId)
        : await ReviewService.findAllByUser(userId);

      const tags = await TagService.findByUserId(userId);
      const selectedTag = selectedTagId
        ? tags.find((tag) => tag.id === selectedTagId) || null
        : null;

      console.log("RENDER REVIEWS WITH USER:", res.locals.currentUser || null);
      console.log("RAW TAG ID:", rawTagId);
      console.log("SELECTED TAG ID:", selectedTagId);
      console.log("SELECTED TAG:", selectedTag);

      return res.render("pages/reviews/index", {
        title: "Mes reviews - GamingBox",
        reviews,
        tags: tags || [],
        selectedTagId,
        selectedTag,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("REVIEW INDEX ERROR:", error);
      return res.redirect("/");
    }
  }

  // Détails d'une review
  async show(req, res) {
    try {
      console.log("=== REVIEW SHOW START ===");
      console.log("REQ PARAMS:", req.params);
      console.log("REQ PARAMS SLUG:", req.params.slug);
      console.log("SESSION USER ID:", req.session.userId);

      const review = await ReviewService.findBySlug(
        req.params.slug,
        req.session.userId,
      );

      console.log("REVIEW FOUND:", review);

      if (!review) {
        console.log("REVIEW NOT FOUND FOR SLUG:", req.params.slug);
        return res.status(404).render("pages/errors/404");
      }

      const tags = await ReviewService.getTagsByReviewId(review.id);
      const availableTags = await TagService.findByUserId(req.session.userId);
      const selectedTagIds = (tags || []).map((tag) => tag.id);

      console.log("TAGS FOUND:", tags);
      console.log("=== REVIEW SHOW END ===");

      return res.render("pages/reviews/show", {
        title: "Détail de la review - GamingBox",
        review,
        tags: tags || [],
        availableTags: availableTags || [],
        selectedTagIds,
        csrfToken: generateToken(req, res),
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("REVIEW SHOW ERROR:", error);
      req.flash("error", "Impossible de charger la review.");
      return res.redirect("/reviews");
    }
  }

  // Formulaire de création d'une review
  async new(req, res) {
    try {
      const games = await GameService.findAllByGameId();
      const tags = await TagService.findByUserId(req.session.userId);

      console.log("=== REVIEW NEW ===");
      console.log("GAMES RAW:", games);
      console.log("GAMES IS ARRAY:", Array.isArray(games));
      console.log("GAMES LENGTH:", games?.length);
      console.log("TAGS RAW:", tags);

      if (games?.length) {
        console.log("FIRST GAME:", games[0]);
        console.log("FIRST GAME JSON:", JSON.stringify(games[0], null, 2));
      }

      return res.render("pages/reviews/new", {
        title: "Nouvelle review - GamingBox",
        csrfToken: generateToken(req, res),
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
        games: games || [],
        tags: tags || [],
      });
    } catch (error) {
      console.error("REVIEW NEW ERROR:", error);

      return res.render("pages/reviews/new", {
        title: "Nouvelle review - GamingBox",
        csrfToken: generateToken(req, res),
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
        games: [],
        tags: [],
      });
    }
  }

  // Création (on stocke la review)
  async store(req, res) {
    try {
      console.log("=== REVIEW STORE START ===");
      console.log("SESSION USER ID:", req.session.userId);
      console.log("REVIEW BODY:", req.body);
      console.log("GAME ID:", req.body.gameId);
      console.log("REVIEW TITLE:", req.body.reviewTitle);
      console.log("REVIEW RATE:", req.body.reviewRate);
      console.log("TAG IDS:", req.body.tagIds);

      const review = await ReviewService.create(
        req.session.userId,
        req.body.gameId,
        req.body,
      );

      console.log("REVIEW CREATED:", review);
      console.log("=== REVIEW STORE END ===");

      req.flash("success", "Review enregistrée avec succès ✅");
      return res.redirect("/reviews");
    } catch (error) {
      console.error("REVIEW STORE ERROR:", error);
      req.flash("error", error.message || "Impossible d'enregistrer la review.");
      return res.redirect("/reviews/new");
    }
  }

  // Formulaire d'édition de la review
  async edit(req, res) {
    try {
      const review = await ReviewService.findBySlug(
        req.params.slug,
        req.session.userId,
      );

      if (!review) {
        return res.status(404).render("pages/errors/404");
      }

      const tags = await TagService.findByUserId(req.session.userId);
      const reviewTags = await ReviewService.getTagsByReviewId(review.id);
      const selectedTagIds = (reviewTags || []).map((tag) => tag.id);

      return res.render("pages/reviews/edit", {
        title: "Modifier la review - GamingBox",
        review,
        tags: tags || [],
        selectedTagIds,
        csrfToken: generateToken(req, res),
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("REVIEW EDIT ERROR:", error);
      req.flash("error", "Impossible de charger la review.");
      return res.redirect("/reviews");
    }
  }

  // Mise à jour de la review
  async update(req, res) {
    try {
      await ReviewService.update(req.session.userId, req.params.slug, req.body);
      req.flash("success", "La review a bien été mise à jour ✅");
      return res.redirect("/reviews");
    } catch (error) {
      console.error("REVIEW UPDATE ERROR:", error);
      req.flash("error", error.message || "Impossible de mettre à jour la review.");
      return res.redirect(`/reviews/${req.params.slug}/edit`);
    }
  }

  // Associer des tags depuis la page détail de la review
  async updateTags(req, res) {
    try {
      await ReviewService.replaceTagsBySlug(
        req.session.userId,
        req.params.slug,
        req.body.tagIds,
      );

      req.flash("success", "Les tags de la review ont bien été mis à jour ✅");
      return res.redirect(`/reviews/${req.params.slug}`);
    } catch (error) {
      console.error("REVIEW UPDATE TAGS ERROR:", error);
      req.flash("error", error.message || "Impossible de mettre à jour les tags.");
      return res.redirect(`/reviews/${req.params.slug}`);
    }
  }

  // Suppréssion de la review
  async destroy(req, res) {
    try {
      await ReviewService.deleteReview(req.session.userId, req.params.slug);
      req.flash("success", "La review a bien été supprimée 🗑️");
      return res.redirect("/reviews");
    } catch (error) {
      console.error("REVIEW DELETE ERROR:", error);
      req.flash("error", error.message || "Impossible de supprimer la review.");
      return res.redirect("/reviews");
    }
  }
}

export default new ReviewController();
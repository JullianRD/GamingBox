"use strict";

import ReviewService from "../services/ReviewService.js";
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
      const reviews = await ReviewService.findAllByUser(userId);

      console.log("RENDER REVIEWS WITH USER:", res.locals.currentUser || null);

      return res.render("pages/reviews/index", {
        title: "Mes reviews - GamingBox",
        reviews,
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
      const review = await ReviewService.findById(req.params.id);
      const tags = await ReviewService.getTags(req.params.id);

      if (!review) {
        return res.status(404).render("pages/errors/404");
      }

      return res.render("pages/reviews/show", {
        title: "Détail de la review - GamingBox",
        review,
        tags,
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

  new(req, res) {
    return res.render("pages/reviews/new", {
      title: "Nouvelle review - GamingBox",
      csrfToken: generateToken(req, res),
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  // Création (on stocke la review)

  async store(req, res) {
    try {
      await ReviewService.create(req.session.userId, req.body); // Surement un ajout en parametre d'un IGDB ou Game id
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

      return res.render("pages/reviews/edit", {
        title: "Modifier la review - GamingBox",
        review,
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

  // Mise à jour de la review (Si je comprend bien la logique pour afficher la page on demmande au repo les info en base puis on update les info en les
  //   renvoyant au service)

  async update(req, res) {
    try {
      await ReviewService.update(req.session.userId, req.params.slug, req.body);
      req.flash("success", "La review à bien été mise à jour ✅");
      return res.redirect("/reviews");
    } catch (error) {
      console.error("REVIEW UPDATE ERROR:", error);
      req.flash("error", error.message || "Impossible de mettre à jour la review.");
      return res.redirect(`/reviews/${req.params.slug}/edit`);
    }
  }

  // Suppréssion de la review

  async destroy(req, res) {
    try {
      await ReviewService.deleteReview(req.session.userId, req.params.slug);
      req.flash("success", "La review à bien été supprimé 🗑️");
      return res.redirect("/reviews");
    } catch (error) {
      console.error("REVIEW DELETE ERROR:", error);
      req.flash("error", error.message || "Impossible de supprimer la review.");
      return res.redirect("/reviews");
    }
  }
}

export default new ReviewController();
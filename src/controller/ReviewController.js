"use strict";

import ReviewService from "../services/ReviewService.js";
import PgReviewRepository from "../repositories/PgReviewRepository.js";

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
    const reviews = await PgReviewRepository.findAllByUser(req.user.id);
    res.render("reviews/index", { reviews });
  }

  // Détails d'une review

  async show(req, res) {
    const review = await ReviewService.findById(req.params.id);
    const tags = await ReviewService.getTags(req.params.id);

    if (!review) {
      return res.status(404).render("errors/404");
    }

    res.render("reviews/show", { review, tags });
  }

  // Formulaire de création d'une review

  new(req, res) {
    res.render("reviews/new");
  }

  // Création (on stocke la review)

  async store(req, res) {
    await ReviewService.create(req.user.id, req.body); // Surement un ajout en parametre d'un IGDB ou Game id
    req.flash("Review enregistrée avec succés");
    res.redirect("/reviews/index");
  }

  // Formulaire d'édition de la review

  async edit(req, res) {
    const review = await PgReviewRepository.findBySlug(
      req.params.slug,
      req.user.id,
    );
    if (!review) {
      return res.status(404).render("errors/404");
    }
    res.render("reviews/edit", { review });
  }

  // Mise à jour de la review (Si je comprend bien la logique pour afficher la page on demmande au repo les info en base puis on update les info en les
  //   renvoyant au service)

  async update(req, res) {
    await ReviewService.update(req.user.id, req.params.slug, req.body);
    req.flash("La review à bien été mise à jour");
    res.redirect("/reviews/index");
  }

  // Suppréssion de la review

  async destroy(req, res) {
    await ReviewService.deleteReview(req.user.id, req.params.slug);
    req.flash("La review à bien été supprimé 🗑️");
    res.redirect("/reviews/index");
  }
}

export default new ReviewController();

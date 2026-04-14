"use strict";

import TagService from "../services/TagService.js";

// TagController / Le rendu des tags sur les review se fait directement depuis le reviewController !

class TagController {
  // Liste complète des tags de l'utilisateur

  async index(req, res) {
    try {
      const tags = await TagService.findByUserId(req.session.userId);

      return res.render("pages/tags/index", {
        title: "Mes tags - GamingBox",
        tags,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("TAG INDEX ERROR:", error);
      req.flash("error", "Impossible de charger les tags.");
      return res.redirect("/reviews");
    }
  }

  // Détails d'un tag
  async show(req, res) {
    try {
      const tag = await TagService.findByIdForUser(req.params.id, req.session.userId);

      if (!tag) {
        return res.status(404).render("pages/errors/404");
      }

      return res.render("pages/tags/show", {
        title: "Détail du tag - GamingBox",
        tag,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("TAG SHOW ERROR:", error);
      req.flash("error", "Impossible de charger le tag.");
      return res.redirect("/tags");
    }
  }

  // Formulaire de création du tag
  new(req, res) {
    return res.render("pages/tags/new", {
      title: "Nouveau tag - GamingBox",
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async store(req, res) {
    try {
      await TagService.create(req.session.userId, req.body.tagName);
      req.flash("success", "Tag créé avec succès ✅");

      return res.redirect(req.body.redirectTo || "/reviews");
    } catch (error) {
      console.error("TAG STORE ERROR:", error);
      req.flash("error", error.message || "Impossible de créer le tag.");
      return res.redirect(req.body.redirectTo || "/tags/new");
    }
  }

  // Formulaire de modification du tag
  async edit(req, res) {
    try {
      const tag = await TagService.findByIdForUser(req.params.id, req.session.userId);

      if (!tag) {
        return res.status(404).render("pages/errors/404");
      }

      return res.render("pages/tags/edit", {
        title: "Modifier le tag - GamingBox",
        tag,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("TAG EDIT ERROR:", error);
      req.flash("error", "Impossible de charger le tag.");
      return res.redirect("/tags");
    }
  }

  // Mise à jour d'un tag

  async update(req, res) {
    try {
      await TagService.update(req.params.id, req.session.userId, req.body.tagName);
      req.flash("success", "Le tag a bien été mis à jour ✅");
      return res.redirect(`/tags/${req.params.id}`);
    } catch (error) {
      console.error("TAG UPDATE ERROR:", error);
      req.flash("error", error.message || "Impossible de mettre à jour le tag.");
      return res.redirect(`/tags/${req.params.id}/edit`);
    }
  }

  // Suppression d'un Tag

  async destroy(req, res) {
    try {
      await TagService.delete(req.params.id, req.session.userId);
      req.flash("success", "Le tag a été supprimé avec succès ✅");
      return res.redirect(req.body.redirectTo || "/tags");
    } catch (error) {
      console.error("TAG DELETE ERROR:", error);
      req.flash("error", error.message || "Impossible de supprimer le tag.");
      return res.redirect(req.body.redirectTo || "/tags");
    }
  }
}

export default new TagController();
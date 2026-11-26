"use strict";

import TagService from "../services/TagService.js";
import { AppError } from "../utils/AppError.js";
import { safeRedirect } from "../utils/safeRedirect.js";

// Le rendu des tags sur les reviews se fait depuis ReviewController.

class TagController {
  async index(req, res) {
    const tags = await TagService.findByUserId(req.session.userId);

    return res.render("pages/tags/index", {
      title: "Mes tags - GamingBox",
      tags,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async show(req, res) {
    const tag = await TagService.findByIdForUser(req.params.id, req.session.userId);
    if (!tag) throw AppError.notFound("Tag introuvable.");

    return res.render("pages/tags/show", {
      title: "Détail du tag - GamingBox",
      tag,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  new(req, res) {
    return res.render("pages/tags/new", {
      title: "Nouveau tag - GamingBox",
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async store(req, res) {
    const back = safeRedirect(req.body.redirectTo, "/tags/new");
    try {
      await TagService.create(req.session.userId, req.body.tagName);
      req.flash("success", "Tag créé avec succès");
      return res.redirect(safeRedirect(req.body.redirectTo, "/reviews"));
    } catch (error) {
      if (!error?.isOperational) throw error;
      req.flash("error", error.message);
      return res.redirect(back);
    }
  }

  async edit(req, res) {
    const tag = await TagService.findByIdForUser(req.params.id, req.session.userId);
    if (!tag) throw AppError.notFound("Tag introuvable.");

    return res.render("pages/tags/edit", {
      title: "Modifier le tag - GamingBox",
      tag,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async update(req, res) {
    try {
      await TagService.update(req.params.id, req.session.userId, req.body.tagName);
      req.flash("success", "Le tag a bien été mis à jour");
      return res.redirect(`/tags/${encodeURIComponent(req.params.id)}`);
    } catch (error) {
      if (!error?.isOperational || error.statusCode === 404) throw error;
      req.flash("error", error.message);
      return res.redirect(`/tags/${encodeURIComponent(req.params.id)}/edit`);
    }
  }

  async destroy(req, res) {
    await TagService.delete(req.params.id, req.session.userId);
    req.flash("success", "Le tag a été supprimé avec succès");
    return res.redirect(safeRedirect(req.body.redirectTo, "/tags"));
  }
}

export default new TagController();

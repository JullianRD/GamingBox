"use strict";

import ListService from "../services/ListService.js";

const base = (res) => ({ user: res.locals.currentUser || null, flash: res.locals.flash || {} });
const enc = encodeURIComponent;

class ListController {
  async index(req, res) {
    const lists = await ListService.findAllByUser(req.session.userId);
    return res.render("pages/lists/index", {
      title: "Mes listes - GamingBox",
      lists,
      ...base(res),
    });
  }

  new(req, res) {
    return res.render("pages/lists/form", {
      title: "Nouvelle liste - GamingBox",
      list: null,
      ...base(res),
    });
  }

  async store(req, res) {
    try {
      const list = await ListService.create(req.session.userId, req.body);
      req.flash("success", "Liste créée");
      return res.redirect(`/lists/${enc(list.slug)}`);
    } catch (error) {
      if (!error?.isOperational) throw error;
      req.flash("error", error.message);
      return res.redirect("/lists/new");
    }
  }

  async show(req, res) {
    const detail = await ListService.getDetail(req.session.userId, req.params.slug);
    return res.render("pages/lists/show", {
      title: `${detail.list.title} - GamingBox`,
      ...detail,
      ...base(res),
    });
  }

  async edit(req, res) {
    const list = await ListService.getOwned(req.session.userId, req.params.slug);
    return res.render("pages/lists/form", {
      title: "Modifier la liste - GamingBox",
      list,
      ...base(res),
    });
  }

  async update(req, res) {
    await ListService.update(req.session.userId, req.params.slug, req.body);
    req.flash("success", "Liste mise à jour");
    return res.redirect(`/lists/${enc(req.params.slug)}`);
  }

  async destroy(req, res) {
    await ListService.delete(req.session.userId, req.params.slug);
    req.flash("success", "Liste supprimée");
    return res.redirect("/lists");
  }

  async addItem(req, res) {
    try {
      await ListService.addItem(req.session.userId, req.params.slug, req.body);
      req.flash("success", "Jeu ajouté à la liste");
    } catch (error) {
      if (!error?.isOperational || error.statusCode === 404) throw error;
      req.flash("error", error.message);
    }
    return res.redirect(`/lists/${enc(req.params.slug)}`);
  }

  async removeItem(req, res) {
    await ListService.removeItem(req.session.userId, req.params.slug, req.params.gameId);
    req.flash("success", "Jeu retiré de la liste");
    return res.redirect(`/lists/${enc(req.params.slug)}`);
  }
}

export default new ListController();

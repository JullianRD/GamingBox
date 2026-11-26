"use strict";

import AdminService from "../services/AdminService.js";
import AppEventService from "../services/AppEventService.js";

const LISTS = {
  users: { service: "getAllUsers", view: "users", title: "Admin - Utilisateurs" },
  reviews: { service: "getAllReviews", view: "reviews", title: "Admin - Reviews" },
  tags: { service: "getAllTags", view: "tags", title: "Admin - Tags" },
  shares: { service: "getAllShares", view: "shares", title: "Admin - Partages" },
  games: { service: "getAllGames", view: "games", title: "Admin - Jeux" },
};

const list = (key) => async (req, res) => {
  const { service, view, title } = LISTS[key];
  const items = await AdminService[service]();

  return res.render(`pages/admin/${view}`, {
    title,
    [key]: items,
    user: res.locals.currentUser || null,
    flash: res.locals.flash || {},
  });
};

/** Suppression + journal d'audit + retour à la liste. */
const destroy = (key, serviceMethod, successMessage) => async (req, res) => {
  const ok = await AdminService[serviceMethod](req.params.id, req.session.userId);

  await AppEventService.adminAction(req.session.userId, `${key}_deleted`, {
    targetId: req.params.id,
  });

  req.flash(ok ? "success" : "error", ok ? successMessage : "Ressource introuvable.");
  return res.redirect(`/admin/${key}`);
};

/** Gestion HTTP de l'espace admin. */
class AdminController {
  async index(req, res) {
    const dashboard = await AdminService.getDashboardData();

    return res.render("pages/admin/index", {
      title: "Administration - GamingBox",
      counts: dashboard.counts,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  users = list("users");
  reviews = list("reviews");
  tags = list("tags");
  shares = list("shares");
  games = list("games");

  destroyUser = destroy("users", "deleteUser", "Utilisateur supprimé avec succès");
  destroyReview = destroy("reviews", "deleteReview", "Review supprimée avec succès");
  destroyTag = destroy("tags", "deleteTag", "Tag supprimé avec succès");
  destroyShare = destroy("shares", "deleteShare", "Partage supprimé avec succès");
  destroyGame = destroy("games", "deleteGame", "Jeu supprimé avec succès");
}

export default new AdminController();

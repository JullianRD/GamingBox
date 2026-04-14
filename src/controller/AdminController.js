"use strict";

import AdminService from "../services/AdminService";

/**
 * AdminController
 *
 * Gestion HTTP de l'espace admin v
 */
class AdminController {
  // Dashboard admin
  async index(req, res) {
    try {
      const dashboard = await AdminService.getDashboardData();

      return res.render("pages/admin/index", {
        title: "Administration - GamingBox",
        counts: dashboard.counts,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("ADMIN DASHBOARD ERROR:", error);
      req.flash("error", "Impossible de charger le dashboard admin.");
      return res.redirect("/reviews");
    }
  }

  // Liste des utilisateurs
  async users(req, res) {
    try {
      const users = await AdminService.getAllUsers();

      return res.render("pages/admin/users", {
        title: "Admin - Utilisateurs",
        users,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("ADMIN USERS ERROR:", error);
      req.flash("error", "Impossible de charger les utilisateurs.");
      return res.redirect("/admin");
    }
  }

  // Liste des reviews
  async reviews(req, res) {
    try {
      const reviews = await AdminService.getAllReviews();

      return res.render("pages/admin/reviews", {
        title: "Admin - Reviews",
        reviews,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("ADMIN REVIEWS ERROR:", error);
      req.flash("error", "Impossible de charger les reviews.");
      return res.redirect("/admin");
    }
  }

  // Liste des tags
  async tags(req, res) {
    try {
      const tags = await AdminService.getAllTags();

      return res.render("pages/admin/tags", {
        title: "Admin - Tags",
        tags,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("ADMIN TAGS ERROR:", error);
      req.flash("error", "Impossible de charger les tags.");
      return res.redirect("/admin");
    }
  }

  // Liste des partages
  async shares(req, res) {
    try {
      const shares = await AdminService.getAllShares();

      return res.render("pages/admin/shares", {
        title: "Admin - Partages",
        shares,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("ADMIN SHARES ERROR:", error);
      req.flash("error", "Impossible de charger les partages.");
      return res.redirect("/admin");
    }
  }

  // Liste des jeux
  async games(req, res) {
    try {
      const games = await AdminService.getAllGames();

      return res.render("pages/admin/games", {
        title: "Admin - Jeux",
        games,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("ADMIN GAMES ERROR:", error);
      req.flash("error", "Impossible de charger les jeux.");
      return res.redirect("/admin");
    }
  }

  // Suppression utilisateur
  async destroyUser(req, res) {
    try {
      await AdminService.deleteUser(req.params.id);
      req.flash("success", "Utilisateur supprimé avec succès ✅");
      return res.redirect("/admin/users");
    } catch (error) {
      console.error("ADMIN DELETE USER ERROR:", error);
      req.flash("error", "Impossible de supprimer l'utilisateur.");
      return res.redirect("/admin/users");
    }
  }

  // Suppression review
  async destroyReview(req, res) {
    try {
      await AdminService.deleteReview(req.params.id);
      req.flash("success", "Review supprimée avec succès ✅");
      return res.redirect("/admin/reviews");
    } catch (error) {
      console.error("ADMIN DELETE REVIEW ERROR:", error);
      req.flash("error", "Impossible de supprimer la review.");
      return res.redirect("/admin/reviews");
    }
  }

  // Suppression tag
  async destroyTag(req, res) {
    try {
      await AdminService.deleteTag(req.params.id);
      req.flash("success", "Tag supprimé avec succès ✅");
      return res.redirect("/admin/tags");
    } catch (error) {
      console.error("ADMIN DELETE TAG ERROR:", error);
      req.flash("error", "Impossible de supprimer le tag.");
      return res.redirect("/admin/tags");
    }
  }

  // Suppression partage
  async destroyShare(req, res) {
    try {
      await AdminService.deleteShare(req.params.id);
      req.flash("success", "Partage supprimé avec succès ✅");
      return res.redirect("/admin/shares");
    } catch (error) {
      console.error("ADMIN DELETE SHARE ERROR:", error);
      req.flash("error", "Impossible de supprimer le partage.");
      return res.redirect("/admin/shares");
    }
  }

  // Suppression jeu
  async destroyGame(req, res) {
    try {
      await AdminService.deleteGame(req.params.id);
      req.flash("success", "Jeu supprimé avec succès ✅");
      return res.redirect("/admin/games");
    } catch (error) {
      console.error("ADMIN DELETE GAME ERROR:", error);
      req.flash("error", "Impossible de supprimer le jeu.");
      return res.redirect("/admin/games");
    }
  }
}

export default new AdminController();
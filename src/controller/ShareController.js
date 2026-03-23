"use strict";

import ShareService from "../services/ShareService.js";

/**
 * ShareController
 * ---------------
 * Gestion HTTP des partages (SSR)
 *
 * Le controller :
 * - orchestre
 * - récupère req / res
 * - délègue toute décision au service
 */

class ShareController {
  // Liste de tout les partages de l'utilisateur connecté (partage profil comme review)

  async index(req, res) {
    try {
      const userId = req.session.userId;
      const shares = await ShareService.findByUserId(userId);

      return res.render("pages/shares/index", {
        title: "Mes partages - GamingBox",
        shares,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("SHARE INDEX ERROR:", error);
      req.flash("error", "Impossible de charger les partages.");
      return res.redirect("/reviews");
    }
  }

  /**
   * ➕ Formulaire de création d’un partage de profil utilisateur
   */
  async newForProfile(req, res) {
    try {
      const userId = req.session.userId;
      const user = await ShareService.prepareProfileShare(userId);

      return res.render("pages/shares/new/profile", {
        title: "Partager mon profil - GamingBox",
        profile: user,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("SHARE NEW PROFILE ERROR:", error);
      return res.status(403).render("pages/errors/403");
    }
  }

  // Création du partage de profil

  async storeForProfile(req, res) {
    try {
      const share = await ShareService.createShareForProfile({
        userId: req.session.userId,
        recipientEmail: req.body.recipientEmail,
      });

      req.flash("success", "Partage du profil créé avec succès ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE STORE PROFILE ERROR:", error);
      req.flash("error", error.message || "Impossible de créer le partage.");
      return res.redirect("/shares/new/profile");
    }
  }

  // Formulaire de création de partage pour une review

  async newForReview(req, res) {
    const userId = req.session.userId;
    const { reviewId } = req.query;

    try {
      const review = await ShareService.prepareReviewShare(reviewId, userId);

      return res.render("pages/shares/new/review", {
        title: "Partager une review - GamingBox",
        review,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("SHARE NEW REVIEW ERROR:", error);
      return res.status(403).render("pages/errors/403");
    }
  }

  /**
   * 💾 Création du partage de la review
   */
  async storeForReview(req, res) {
    try {
      await ShareService.createShareForReview({
        reviewId: req.body.reviewId,
        ownerUserId: req.session.userId,
        recipientEmail: req.body.recipientEmail,
      });

      req.flash("success", "Partage de la review créé avec succès ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE STORE REVIEW ERROR:", error);
      req.flash("error", error.message || "Impossible de créer le partage.");
      return res.redirect(`/shares/new/review?reviewId=${req.body.reviewId}`);
    }
  }

  // Révocation d'un partage

  async destroy(req, res) {
    try {
      await ShareService.deleteShare(req.params.id, req.session.userId);
      req.flash("success", "Le partage a été révoqué ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE DELETE ERROR:", error);
      req.flash("error", error.message || "Impossible de supprimer le partage.");
      return res.redirect("/shares");
    }
  }

  // Accés public à la ressource via un token sécurisé

  async access(req, res) {
    const { token } = req.params;

    try {
      const share = await ShareService.accessByToken(token);

      if (share.shareType === "review") {
        return res.render("pages/shares/public-review", {
          title: "Review partagée - GamingBox",
          share,
        });
      }

      return res.render("pages/shares/public-profile", {
        title: "Profil partagé - GamingBox",
        share,
      });
    } catch (error) {
      console.error("SHARE ACCESS ERROR:", error);
      return res.status(403).render("pages/errors/403");
    }
  }
}

export default new ShareController();
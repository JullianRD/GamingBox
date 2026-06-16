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
  // Liste de tous les partages de l'utilisateur connecté (profil + review)
  async index(req, res) {
    try {
      const userId = req.session.userId;
      const shares = await ShareService.findByUserId(userId);

      return res.render("pages/shares/index", {
        title: "Mes partages",
        shares: shares || [],
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
    const userId = req.session.userId;

    try {
      const profile = await ShareService.prepareProfileShare(userId);

      return res.render("pages/shares/new/profile", {
        title: "Partager un profil utilisateur",
        profile,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("SHARE NEW PROFILE ERROR:", error);
      return res.status(403).render("pages/errors/403");
    }
  }

  /**
   * Alias de compatibilité si d'autres fichiers appellent encore l'ancien nom
   */
  async newforProfil(req, res) {
    return this.newForProfile(req, res);
  }

  /**
   * 💾 Création du partage de profil
   */
  async storeForProfile(req, res) {
    try {
      const userId = req.session.userId;
      const { recipientEmail, allow_download, expiration, maxViews } = req.body;

      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.createShareForProfile({
        userId,
        recipientEmail,
        accessConfig,
      });

      req.flash("success", "Partage du profil créé avec succès ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE STORE PROFILE ERROR:", error);
      req.flash(
        "error",
        error.message || "Impossible de créer le partage du profil.",
      );
      return res.redirect("/shares/new/profile");
    }
  }

  /**
   * Alias de compatibilité si d'autres fichiers appellent encore l'ancien nom
   */
  async storeForProfil(req, res) {
    return this.storeForProfile(req, res);
  }

  /**
   * ➕ Formulaire de création de partage pour une review
   */
  async newForReview(req, res) {
    const userId = req.session.userId;
    const { reviewId } = req.query;

    try {
      const review = await ShareService.prepareReviewShare(reviewId, userId);

      return res.render("pages/shares/new/review", {
        title: "Partager une review",
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
      const userId = req.session.userId;
      const { reviewId, recipientEmail, allow_download, expiration, maxViews } =
        req.body;

      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.createShareForReview({
        userId,
        reviewId,
        recipientEmail,
        accessConfig,
      });

      req.flash("success", "Partage de la review créé avec succès ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE STORE REVIEW ERROR:", error);
      req.flash(
        "error",
        error.message || "Impossible de créer le partage de la review.",
      );

      if (req.body.reviewId) {
        return res.redirect(`/shares/new/review?reviewId=${req.body.reviewId}`);
      }

      return res.redirect("/shares");
    }
  }

  /**
   * ✏️ Édition des droits d’un partage
   */
  async edit(req, res) {
    try {
      const { id } = req.params;
      const userId = req.session.userId;

      const share = await ShareService.findById(id);

      if (!share) {
        return res.status(404).render("pages/errors/404");
      }

      if (share.userId !== userId) {
        return res.status(403).render("pages/errors/403");
      }

      return res.render("pages/shares/edit", {
        title: "Modifier le partage",
        share,
        user: res.locals.currentUser || null,
        flash: res.locals.flash || {},
      });
    } catch (error) {
      console.error("SHARE EDIT ERROR:", error);
      req.flash("error", "Impossible de charger le partage.");
      return res.redirect("/shares");
    }
  }

  /**
   * 🔄 Mise à jour des droits pour un partage
   */
  async update(req, res) {
    const { id } = req.params;
    const { allow_download, expiration, maxViews } = req.body;

    try {
      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.updateAccess(id, accessConfig);

      req.flash("success", "Le partage a bien été mis à jour ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE UPDATE ERROR:", error);
      req.flash(
        "error",
        error.message || "Impossible de mettre à jour le partage.",
      );
      return res.redirect("/shares");
    }
  }

  /**
   * 🗑️ Révocation d'un partage
   */
  async destroy(req, res) {
    try {
      const { id } = req.params;

      await ShareService.deleteShare(id);

      req.flash("success", "Partage révoqué avec succès ✅");
      return res.redirect("/shares");
    } catch (error) {
      console.error("SHARE DELETE ERROR:", error);
      req.flash(
        "error",
        error.message || "Impossible de supprimer le partage.",
      );
      return res.redirect("/shares");
    }
  }

  /**
   * 🌍 Accès public à la ressource via un token sécurisé
   */
  async access(req, res) {
    const { token } = req.params;

    try {
      const share = await ShareService.accessByToken(token);

      return res.render("pages/shares/public", {
        title: "Accès partagé à la ressource",
        share,
      });
    } catch (error) {
      console.error("SHARE ACCESS ERROR:", error);
      return res.status(403).render("pages/errors/403");
    }
  }
}

export default new ShareController();
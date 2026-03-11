"use strict";

import ShareService from "../services/ShareService.js";

/**
 * ShareController (explication des controllers)
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
    const userId = req.user.id;

    const shares = await ShareService.findById(userId);

    res.render("pages/shares/index", {
      title: "Mes partages",
      shares,
    });
  }

  /**
   * ➕ Formulaire de création d’un partage de profil utilisateur
   */
  async newforProfil(req, res) {
    const userId = req.user.id;

    try {
      // Le service valide l’accès au profil utilisateur
      const user = await ShareService.preprareProfilShare(userId);

      res.render("pages/shares/new/profil", {
        title: "Partager un profil utilisateur",
        user,
      });
    } catch (error) {
      res.status(403).render("pages/errors/403");
    }
  }

  // Création du partage de profil

  async storeForProfil(req, res) {
    try {
      const { userId, recipientEmail, allow_download, expiration, maxViews } =
        req.body;

      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.createShareForProfil({
        userId,
        recipientEmail,
        accessConfig,
      });
      res.redirect("pages/shares/index");
    } catch (error) {
      res.status(404).render("pages/errors/404", error.message);
    }
  }

  // Formulaire de création de partage pour une review

  async newForReview(req, res) {
    const userId = req.user.id;
    const { reviewId } = req.query;

    try {
      // Le service valide l’accès à l’review
      const review = await ShareService.prepareReviewShare(reviewId, userId);

      res.render("pages/shares/new/review", {
        title: "Partager une review",
        review,
      });
    } catch (error) {
      res.status(403).render("pages/errors/403");
    }
  }

  /**
   * 💾 Création du partage de la review
   */
  async storeForReview(req, res) {
    try {
      const { reviewId, recipientEmail, allow_download, expiration, maxViews } =
        req.body;

      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.createShareForReview({
        reviewId,
        recipientEmail,
        accessConfig,
      });

      res.redirect("pages/shares/index");
    } catch (error) {
      res.status(400).render("pages/errors/400", {
        message: error.message,
      });
    }
  }

  /**
   * ✏️ Édition des droits d’un partage peut importe le type de la ressource
   */
  async edit(req, res) {
    const { id } = req.params;

    const share = await ShareRepository.findById(id);

    if (!share) {
      return res.status(404).render("pages/errors/404");
    }

    res.render("pages/shares/edit", {
      title: "Modifier le partage",
      share,
    });
  }

  /**
   * 🔄 Mise à jour des droits pour un partage de review
   */
  async updateForReview(req, res) {
    const { id } = req.params;
    const { allow_download, expiration, maxViews } = req.body;

    try {
      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.updateAccessForReview(id, accessConfig);

      res.redirect("pages/shares/index");
    } catch (error) {
      res.status(400).render("pages/errors/400", {
        message: error.message,
      });
    }
  }

    /**
   * 🔄 Mise à jour des droits pour un partage de profil
   */
  async updateForProfil(req, res) {
    const { id } = req.params;
    const { allow_download, expiration, maxViews } = req.body;

    try {
      const accessConfig = {
        allow_download: allow_download === "on",
        expiration: expiration || null,
        maxViews: maxViews ? Number(maxViews) : null,
      };

      await ShareService.updateAccessForProfil(id, accessConfig);

      res.redirect("pages/shares/index");
    } catch (error) {
      res.status(400).render("pages/errors/400", {
        message: error.message,
      });
    }
  }

  // Révocation d'un partage

  async destroy(req, res) {
    const { id } = req.params;

    await ShareService.deleteShare(id);

    res.redirect("pages/shares/index");
  }

  // Accés public à la ressource via un token sécurisé

  async access(req, res) {
    const { token } = req.params;

    try {
      const share = await ShareService.accessByToken(token);

      res.render("pages/shares/public", {
        title: "Accés partagé à la ressource",
        share,
      });
    } catch (error) {
      res.render(403).render("pages/error/403");
    }
  }
}

export default new ShareController();

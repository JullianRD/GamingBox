"use strict";

import ShareService from "../services/ShareService.js";
import { AppError } from "../utils/AppError.js";

/**
 * ShareController : gestion HTTP des partages (SSR).
 * Le contrôleur orchestre ; les règles (propriété, expiration, limite de vues) sont dans le service.
 */
class ShareController {
  async index(req, res) {
    const shares = await ShareService.findByUserId(req.session.userId);

    return res.render("pages/shares/index", {
      title: "Mes partages",
      shares: shares || [],
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async newForProfile(req, res) {
    const profile = await ShareService.prepareProfileShare(req.session.userId);

    return res.render("pages/shares/new/profile", {
      title: "Partager un profil utilisateur",
      profile,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async storeForProfile(req, res) {
    const { recipientEmail, allow_download, expiration, maxViews } = req.body;

    try {
      await ShareService.createShareForProfile({
        userId: req.session.userId,
        recipientEmail,
        accessConfig: { allow_download, expiration, maxViews },
      });
      req.flash("success", "Partage du profil créé : le lien a été envoyé par email.");
      return res.redirect("/shares");
    } catch (error) {
      if (!error?.isOperational) throw error;
      req.flash("error", error.message);
      return res.redirect("/shares/new/profile");
    }
  }

  async newForReview(req, res) {
    const review = await ShareService.prepareReviewShare(req.query.reviewId, req.session.userId);

    return res.render("pages/shares/new/review", {
      title: "Partager une review",
      review,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async storeForReview(req, res) {
    const { reviewId, recipientEmail, allow_download, expiration, maxViews } = req.body;

    try {
      await ShareService.createShareForReview({
        userId: req.session.userId,
        reviewId,
        recipientEmail,
        accessConfig: { allow_download, expiration, maxViews },
      });
      req.flash("success", "Partage de la review créé : le lien a été envoyé par email.");
      return res.redirect("/shares");
    } catch (error) {
      if (!error?.isOperational || [403, 404].includes(error.statusCode)) throw error;
      req.flash("error", error.message);
      return res.redirect(`/shares/new/review?reviewId=${encodeURIComponent(reviewId)}`);
    }
  }

  async destroy(req, res) {
    await ShareService.deleteShare(req.params.id, req.session.userId);
    req.flash("success", "Partage révoqué avec succès");
    return res.redirect("/shares");
  }

  // Accès public via un lien secret (aucune authentification)
  async access(req, res) {
    // Le jeton est dans l'URL : pas de mise en cache, pas d'indexation, pas de Referer sortant
    res.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    });

    const share = await ShareService.accessByToken(req.params.token);

    const og =
      share.type === "review"
        ? {
            title: `${share.review.reviewTitle} - review de ${share.user.pseudo}`,
            description: `${share.review.gameTitle} : ${share.review.reviewRate}/10`,
            image: share.review.thumbnailUrl,
          }
        : {
            title: `Profil de ${share.profile.pseudo} - GamingBox`,
            description: `${share.profile.totalReviews} reviews, ${share.profile.finishedGames} jeux terminés`,
            image: null,
          };

    return res.render(`pages/shares/public-${share.type}`, {
      title: og.title,
      og,
      share,
    });
  }
}

export default new ShareController();

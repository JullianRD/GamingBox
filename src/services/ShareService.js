"use strict";

import crypto from "node:crypto";
import ShareRepository from "../repositories/PgShareRepository.js";
import ReviewRepository from "../repositories/PgReviewRepository.js";
import UserRepository from "../repositories/PgUserRepository.js";
import MailService from "./MailService.js";
import AppEventService from "./AppEventService.js";
import { AppError } from "../utils/AppError.js";

const MAX_VIEWS_LIMIT = 10_000;

/** Jeton d'accès : 256 bits aléatoires, utilisable dans une URL. */
const newToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * Normalise et valide les droits d'accès d'un partage.
 * - expiration : date valide et dans le futur (ou vide)
 * - maxViews : entier positif (ou vide)
 */
export function normalizeAccessConfig({ allow_download, expiration, maxViews } = {}) {
  let expirationIso = null;
  if (expiration) {
    const date = new Date(expiration);
    if (Number.isNaN(date.getTime())) throw AppError.badRequest("Date d'expiration invalide.");
    if (date <= new Date())
      throw AppError.badRequest("La date d'expiration doit être dans le futur.");
    expirationIso = date.toISOString();
  }

  let maxViewsNumber = null;
  if (maxViews !== undefined && maxViews !== null && maxViews !== "") {
    maxViewsNumber = Number(maxViews);
    if (
      !Number.isInteger(maxViewsNumber) ||
      maxViewsNumber < 1 ||
      maxViewsNumber > MAX_VIEWS_LIMIT
    ) {
      throw AppError.badRequest(
        `Le nombre de vues doit être un entier entre 1 et ${MAX_VIEWS_LIMIT}.`,
      );
    }
  }

  return {
    allow_download: allow_download === true || allow_download === "on" || allow_download === "true",
    expiration: expirationIso,
    maxViews: maxViewsNumber,
  };
}

class ShareService {
  static findByUserId(userId) {
    return ShareRepository.findByUserId(userId);
  }

  static findProfileSharesByUserId(userId) {
    return ShareRepository.findProfileSharesByUserId(userId);
  }

  static findReviewSharesByUserId(userId) {
    return ShareRepository.findReviewSharesByUserId(userId);
  }

  // Un partage envoie un email à un tiers : l'expéditeur doit avoir confirmé sa propre adresse
  static async #requireVerifiedSender(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) throw AppError.notFound("Utilisateur introuvable.");
    if (!user.emailVerifiedAt) {
      throw AppError.forbidden("Confirme ton adresse email avant de partager du contenu.");
    }
    return user;
  }

  static async createShareForProfile({ userId, recipientEmail, accessConfig }) {
    const owner = await this.#requireVerifiedSender(userId);

    if (await ShareRepository.existByProfileAndEmail(userId, recipientEmail)) {
      throw AppError.conflict("Cette personne a déjà accès à ton profil.");
    }

    const token = newToken();
    const share = await ShareRepository.createShareForProfile({
      userId,
      recipientEmail,
      shareToken: token,
      accessConfig: normalizeAccessConfig(accessConfig),
    });

    await MailService.sendShareInvitation({
      to: recipientEmail,
      ownerPseudo: owner.pseudo,
      kind: "profile",
      token,
    });
    await AppEventService.shareCreated(userId, share.id);
    return { share, token };
  }

  static async createShareForReview({ userId, reviewId, recipientEmail, accessConfig }) {
    const owner = await this.#requireVerifiedSender(userId);
    await this.prepareReviewShare(reviewId, userId);

    if (await ShareRepository.existByReviewAndEmail(reviewId, recipientEmail)) {
      throw AppError.conflict("Cette personne a déjà accès à cette review.");
    }

    const token = newToken();
    const share = await ShareRepository.createShareForReview({
      userId,
      reviewId,
      recipientEmail,
      shareToken: token,
      accessConfig: normalizeAccessConfig(accessConfig),
    });

    await MailService.sendShareInvitation({
      to: recipientEmail,
      ownerPseudo: owner.pseudo,
      kind: "review",
      token,
    });
    await AppEventService.shareCreated(userId, share.id);
    return { share, token };
  }

  // Une review ne peut être partagée que par son propriétaire
  static async prepareReviewShare(reviewId, userId) {
    const review = await ReviewRepository.findById(reviewId);
    if (!review) throw AppError.notFound("Review introuvable.");
    if (review.userId !== userId) throw AppError.forbidden("Cette review ne t'appartient pas.");
    return review;
  }

  static async prepareProfileShare(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) throw AppError.notFound("Utilisateur introuvable.");
    return user;
  }

  // Révocation : uniquement par le propriétaire du partage
  static async deleteShare(id, userId) {
    const deleted = await ShareRepository.deleteForUser(id, userId);
    if (!deleted) throw AppError.notFound("Partage introuvable.");
    return true;
  }

  /**
   * Accès public via le lien reçu par email. Le compteur de vues, l'expiration
   * et la limite sont contrôlés atomiquement par le repository.
   */
  static async accessByToken(token) {
    if (typeof token !== "string" || token.length < 20 || token.length > 128) {
      throw AppError.notFound(
        "Ce lien de partage est invalide, expiré ou a atteint sa limite de vues.",
      );
    }

    const share = await ShareRepository.registerAccess(token);
    if (!share) {
      throw AppError.notFound(
        "Ce lien de partage est invalide, expiré ou a atteint sa limite de vues.",
      );
    }

    await AppEventService.shareAccessed(share.id);

    if (share.reviewId) {
      const data = await ShareRepository.findPublicReview(share.id);
      if (!data) throw AppError.notFound("Cette review n'est plus disponible.");
      return {
        type: "review",
        allowDownload: Boolean(share.accessConfig?.allow_download),
        user: { pseudo: data.user_pseudo, avatar: data.user_avatar },
        review: {
          reviewTitle: data.review_title,
          slug: data.slug,
          avisReview: data.avis_review,
          reviewRate: data.review_rate,
          gamePlatforme: data.game_platforme,
          progressionStatus: data.progression_status,
          reviewLike: data.review_like,
          reviewPlatine: data.review_platine,
          gameTitle: data.game_title,
          thumbnailUrl: data.thumbnail_url,
          gameGenre: data.game_genre,
          releaseDate: data.release_date,
        },
      };
    }

    const data = await ShareRepository.findPublicProfile(share.id);
    if (!data) throw AppError.notFound("Ce profil n'est plus disponible.");
    return {
      type: "profile",
      allowDownload: Boolean(share.accessConfig?.allow_download),
      profile: {
        pseudo: data.pseudo,
        avatar: data.avatar,
        biographie: data.biographie,
        totalReviews: Number(data.total_reviews),
        finishedGames: Number(data.finished_games),
        platineGames: Number(data.platine_games),
        likedGames: Number(data.liked_games),
      },
    };
  }
}

export default ShareService;

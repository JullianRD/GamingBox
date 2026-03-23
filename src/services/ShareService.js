"use strict";

import crypto from "node:crypto";
import ShareRepository from "../repositories/PgShareRepository.js";
import ReviewRepository from "../repositories/PgreviewRepository.js";
import UserRepository from "../repositories/PgUserRepository.js";

// ShareService : logique métier lié aux partages des ressources (profil utilisateur et review)

class ShareService {
  // Trouver tout les partages créée par un utilisateur (peut importe la ressource)
  static async findByUserId(userId) {
    return ShareRepository.findByUserId(userId);
  }

  // Trouver tout les partages de profil d'un utilisateur
  static async findProfileSharesByUserId(userId) {
    return ShareRepository.findProfileSharesByUserId(userId);
  }

  // Créer un partage vers un profil utilisateur
  static async createShareForProfile({ userId, recipientEmail }) {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const exists = await ShareRepository.existByProfileAndEmail(
      userId,
      recipientEmail,
    );

    if (exists) {
      throw new Error("Cette personne a déjà accès à cette ressource.");
    }

    return ShareRepository.createShareForProfile({
      userId,
      recipientEmail,
      shareToken: crypto.randomUUID(),
    });
  }

  // Créer un partage vers une review d'un utilisateur
  static async createShareForReview({ reviewId, ownerUserId, recipientEmail }) {
    const review = await ReviewRepository.findByIdComplete(reviewId);

    if (!review) {
      throw new Error("REVIEW_NOT_FOUND");
    }

    if (review.userId !== ownerUserId) {
      throw new Error("FORBIDDEN");
    }

    const exists = await ShareRepository.existByReviewAndEmail(
      reviewId,
      recipientEmail,
    );

    if (exists) {
      throw new Error("Cette personne a déjà accès à cette ressource.");
    }

    return ShareRepository.createShareForReview({
      userId: ownerUserId,
      reviewId,
      recipientEmail,
      shareToken: crypto.randomUUID(),
    });
  }

  // Formulaire de partage pour le profil
  static async prepareProfileShare(userId) {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return user;
  }

  // Formulaire de partage pour une review
  static async prepareReviewShare(reviewId, userId) {
    const review = await ReviewRepository.findByIdComplete(reviewId);

    if (!review) {
      throw new Error("REVIEW_NOT_FOUND");
    }

    if (review.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    return review;
  }

  // Accès à la ressource via un token
  static async accessByToken(token) {
    let share = await ShareRepository.findPublicReviewByToken(token);

    if (!share) {
      share = await ShareRepository.findPublicProfileByToken(token);
    }

    if (!share) {
      throw new Error("INVALID_TOKEN");
    }

    const config = share.accessConfig || {};
    const expiration = config.expiration;
    const maxViews = config.max_views;
    const viewCount = config.view_count || 0;

    if (expiration && new Date(expiration) < new Date()) {
      throw new Error("TOKEN_EXPIRED");
    }

    if (maxViews !== null && maxViews !== undefined && viewCount >= maxViews) {
      throw new Error("MAX_VIEWS_REACHED");
    }

    await ShareRepository.incrementViewCount(share.id);

    if (share.shareType === "review") {
      return ShareRepository.findPublicReviewByToken(token);
    }

    return ShareRepository.findPublicProfileByToken(token);
  }

  // Supprimer un partage
  static async deleteShare(id, userId) {
    const share = await ShareRepository.findById(id);

    if (!share) {
      throw new Error("SHARE_NOT_FOUND");
    }

    if (share.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    return ShareRepository.delete(id);
  }

  // Suppression en cascade pour une review
  static async deleteSharesForReview(reviewId) {
    return ShareRepository.deleteByReviewId(reviewId);
  }

  // Suppression en cascade pour un profil
  static async deleteSharesByProfile(userId) {
    return ShareRepository.deleteByProfileId(userId);
  }
}

export default ShareService;
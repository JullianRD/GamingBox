"use strict";

import crypto from "node:crypto";
import ShareRepository from "../repositories/PgShareRepository.js";
import ReviewRepository from "../repositories/PgReviewRepository.js";
import UserRepository from "../repositories/PgUserRepository.js";

// ShareService : logique métier liée aux partages des ressources (profil utilisateur et review)

class ShareService {
  // Trouver un partage par son id
  static async findById(id) {
    return ShareRepository.findById(id);
  }

  // Trouver tous les partages créés par un utilisateur
  static async findByUserId(userId) {
    return ShareRepository.findByUserId(userId);
  }

  // Trouver tous les partages de profil d'un utilisateur
  static async findProfileSharesByUserId(userId) {
    return ShareRepository.findProfileSharesByUserId(userId);
  }

  // Trouver tous les partages de review d'un utilisateur
  static async findReviewSharesByUserId(userId) {
    return ShareRepository.findReviewSharesByUserId(userId);
  }

  // Créer un partage vers un profil utilisateur
  static async createShareForProfile({ userId, recipientEmail, accessConfig }) {
    const exists = await ShareRepository.existByProfileAndEmail(
      userId,
      recipientEmail,
    );

    if (exists) {
      throw new Error("Cette personne a déjà accès à cette ressource");
    }

    return ShareRepository.createShareForProfile({
      userId,
      recipientEmail,
      shareToken: crypto.randomUUID(),
      accessConfig,
    });
  }

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async createShareForProfil(payload) {
    return this.createShareForProfile(payload);
  }

  // Créer un partage vers une review d'un utilisateur
  static async createShareForReview({
    userId,
    reviewId,
    recipientEmail,
    accessConfig,
  }) {
    const exists = await ShareRepository.existByReviewAndEmail(
      reviewId,
      recipientEmail,
    );

    if (exists) {
      throw new Error("Cette personne a déjà accès à cette ressource");
    }

    return ShareRepository.createShareForReview({
      userId,
      reviewId,
      recipientEmail,
      shareToken: crypto.randomUUID(),
      accessConfig,
    });
  }

  // Formulaire de partage pour une review
  static async prepareReviewShare(reviewId, userId) {
    const review = await ReviewRepository.findById(reviewId);

    if (!review) {
      throw new Error("REVIEW_NOT_FOUND");
    }

    if (review.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    return review;
  }

  // Formulaire de partage pour le profil
  static async prepareProfileShare(userId) {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return user;
  }

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async preprareProfilShare(userId) {
    return this.prepareProfileShare(userId);
  }

  // Modifier les droits d'un partage pour une review
  static async prepareEditForReview(shareId, userId) {
    const share = await ShareRepository.findById(shareId);

    if (!share) {
      throw new Error("SHARE_NOT_FOUND");
    }

    const review = await ReviewRepository.findById(share.reviewId);

    if (!review || review.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    return { share, review };
  }

  // Modifier les droits d'un partage pour un profil
  static async prepareEditForProfile(shareId, userId) {
    const share = await ShareRepository.findById(shareId);

    if (!share) {
      throw new Error("SHARE_NOT_FOUND");
    }

    if (share.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    return share;
  }

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async prepareEditForProfil(shareId, userId) {
    return this.prepareEditForProfile(shareId, userId);
  }

  // Modifier les droits d'un partage
  static async updateAccess(id, accessConfig) {
    if (accessConfig.expiration) {
      const expDate = new Date(accessConfig.expiration);

      if (expDate < new Date()) {
        throw new Error("INVALID_EXPIRATION_DATE");
      }
    }

    return ShareRepository.updateAccessConfig(id, accessConfig);
  }

  // Accès à la ressource via un token
  static async accessByToken(token) {
    throw new Error("Méthode non finalisée pour l'accès public.");
  }

  // Supprimer un partage
  static async deleteShare(id) {
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

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async deleteSharesByProfil(userId) {
    return this.deleteSharesByProfile(userId);
  }
}

export default ShareService;
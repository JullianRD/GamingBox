"use strict"

"use strict";
import crypto from "node:crypto";
import ShareRepository from "../repositories/PgShareRepository.js";
import ReviewRepository from "../repositories/PgReviewRepository.js";
import UserRepository from "../repositories/PgUserRepository.js";

// ShareService : logique métier lié aux partages des ressources (profil utilisateur et review)


class ShareService { 

    // Trouver un partage de review par son id
    static async findByReviewId(id) {
        return ShareRepository.findByReviewId(id)
    }

    // Trouver un partage de profil par son id
    static async findByProfilId(id) {
        return ShareRepository.findByProfilId(id)
    }

    // Trouver tout les partages créée par un utilisateur (peut importe la ressource)
    static async findByUserId(shareId) {
        return ShareRepository.findByUserId(shareId)
    }

    //Créer un partage vers un profil utilisateur
    static async createShareForProfil({ userId, recipientEmail, accessConfig }) {
        const exists = await ShareRepository.existByProfilAndEmail(
            userId,
            recipientEmail,
        );

        if (exists) {
            throw new Error("Cet personne à déjà accés à cette ressource")
        }

        return ShareRepository.create({
            userId,
            recipientEmail,
            shareToken: crypto.randomUUID(),
            accessConfig,
        });
    }

    // Créer un partage vers une review d'un utilisateur
    static async createShareForReview({ reviewId, recipientEmail, accessConfig }) {
        const exists = await ShareRepository.existByReviewAndEmail(
            reviewId,
            recipientEmail,
        );

        if (exists) {
            throw new Error("Cet personne à déjà accés à cette ressource")
        }

        return ShareRepository.create({
            reviewId,
            recipientEmail,
            shareToken: crypto.randomUUID(),
            accessConfig,
        });
    }

    // Fomulaire de partage pour le profil
    static async prepareReviewShare(reviewId, userId) {
        const review = await ReviewRepository.findById(reviewId);

        if (!review) {
            throw new Error("REVIEW_NOT_FOUND");
        }

        if (review.userId !== userId) {
            throw new Error("FORBIDDEN"); 
        }

        return review
    }

    // Formulaire de partage pour une review
    static async preprareProfilShare(userId) {
        const user = await UserRepository.findById(userId);

        if (!user) {
            throw new Error("USER_NOT_FOUND")
        }

        return user
    }

    // Modifier les droits d'un partage pour une review
    static async prepareEditForReview(shareId,userId) {
        const share = await ShareRepository.findByReviewId(shareId);
        if (!share) throw new Error("SHARE_NOT_FOUND");

        const review = await ReviewRepository.findById(share.reviewId);
        if (!review || review.userId !== userId) throw new Error("FORBIDDEN");

        return { share, review};
    }

    // Modifier les droits d'un partage pour un profil
    static async prepareEditForProfil(shareId) {
        const share = await ShareRepository.findByProfilId(shareId);
        if (!share) throw new Error("SHARE_NOT_FOUND");

        return share;
    }

    // Modifier les droits d'un partage pour une review
    static async updateAccessForReview(id, accessConfig) {
    if (accessConfig.expiresAt) {
    const expDate = new Date(accessConfig.expiresAt);
    if (expDate < new Date()) {
        throw new Error("INVALID_EXPIRATION_DATE");
    }
    }

    return ShareRepository.updateAccessConfigReview(id, accessConfig);
    }

    // Modifier les droits d'un partage pour un profil
    static async updateAccessForProfil(id, accessConfig) {
    if (accessConfig.expiresAt) {
    const expDate = new Date(accessConfig.expiresAt);
    if (expDate < new Date()) {
        throw new Error("INVALID_EXPIRATION_DATE");
    }
    }

    return ShareRepository.updateAccessConfigProfil(id, accessConfig);
    }

    // Accès à la ressource via un token 
    static async accessByToken(token) {
    const share = await ShareRepository.findByToken(token);
    if (!share) throw new Error("INVALID_TOKEN");

    const { expiresAt } = share.accessConfig || {};
    if (expiresAt && new Date(expiresAt) < new Date()) {
    throw new Error("TOKEN_EXPIRED");
    }

    return share;
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
    static async deleteSharesByProfil(userId) {
        return ShareRepository.deleteByProfilId(userId);
    }
}

export default ShareService;
"use strict";
/**
 * Service métier reviews
 */
import ReviewRepository from "../repositories/PgreviewRepository.js";
import ReviewTagRepository from "../repositories/PgReviewTagRepository.js";
import { generateSlug } from "../utils/generateSlug.js";

class ReviewService {
  // Trouver toutes les reviews d'un utilisateur et les afficher dans l'index review

  static async findAllByUser(id) {
    return ReviewRepository.findAllByUser(id);
  }

  // Trouver une review via son slug pour un utilisateur donné

  static async findBySlug(slug, userId) {
    return ReviewRepository.findBySlug(slug, userId);
  }

  // Récupérer les tags d'une review via son id
  // L'idée est de pouvoir afficher la review même si il n'y a pas de tags associé

  static async getTagsByReviewId(reviewId) {
    const tags = await ReviewTagRepository.findAllByReview(reviewId);
    return tags || [];
  }

  // Créer une review avec ses tags associés

  static async create(userId, gameId, payload) {
    // Payload = information envoyé par l'utilisateur
    const slug = generateSlug(payload.reviewTitle);

    const review = await ReviewRepository.create({
      userId,
      gameId,
      reviewTitle: payload.reviewTitle,
      slug, // texte mis en forme
      reviewRate: payload.reviewRate,
      reviewLike: payload.reviewLike,
      reviewPlatine: payload.reviewPlatine, // Payload = information envoyé par l'utilisateur
      progressionStatus: payload.progressionStatus,
      avisReview: payload.avisReview,
      gamePlatforme: payload.gamePlatforme,
    });

    const tagIds = payload.tagIds
      ? Array.isArray(payload.tagIds)
        ? payload.tagIds
        : [payload.tagIds]
      : [];

    if (tagIds.length) {
      for (const tagId of tagIds) {
        await ReviewTagRepository.add(review.id, tagId);
      }
    }

    return review;
  }

  // Modifier une pépite

  static async update(userId, slug, payload) {
    const review = await ReviewRepository.findBySlug(slug, userId);

    if (!review) {
      throw new Error("Review introuvable.");
    }

    const data = { ...payload };

    // Règle métier légère pour mettre en forme le texte du titre de la review
    if (payload.reviewTitle) {
      data.slug = generateSlug(payload.reviewTitle);
    }

    const updatedReview = await ReviewRepository.update(review.id, data);

    // modifier les tags associé aux reviews
    if (payload.tagIds !== undefined) {
      const tagIds = Array.isArray(payload.tagIds)
        ? payload.tagIds
        : payload.tagIds
          ? [payload.tagIds]
          : [];

      await ReviewTagRepository.replaceForReview(review.id, tagIds);
    }

    return updatedReview;
  }

  // Supprimer une review proprement

  static async deleteReview(userId, slug) {
    const review = await ReviewRepository.findBySlug(slug, userId);

    if (!review) {
      throw new Error("Review introuvable.");
    }

    await ReviewTagRepository.clearForReview(review.id);
    return ReviewRepository.delete(review.id);
  }
}

export default ReviewService;
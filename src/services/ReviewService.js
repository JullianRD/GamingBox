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

  // Trouver une review par son id

  static async findById(id) {
    return ReviewRepository.findById(id);
  }

  // Récupérer les tags d'une review

  static async getTags(reviewId) {
    return ReviewTagRepository.findAllByReview(reviewId);
  }

  // Trouver une review via son slug pour un utilisateur donné

  static async findBySlug(slug, userId) {
    return ReviewRepository.findBySlug(slug, userId);
  }

  // Créer une review avec ses tags associés

  static async create(userId, payload) {
    // Payload = information envoyé par l'utilisateur
    const slug = generateSlug(payload.reviewTitle);

    const review = await ReviewRepository.create({
      userId,
      gameId: payload.gameId ?? null,
      reviewTitle: payload.reviewTitle,
      slug, // texte mis en forme
      reviewRate: payload.reviewRate,
      reviewLike: payload.reviewLike, // Payload = information envoyé par l'utilisateur
      reviewPlatine: payload.reviewPlatine,
      progressionStatus: payload.progressionStatus,
      avisReview: payload.avisReview,
      gamePlatforme: payload.gamePlatforme,
    });

    if (payload.tagIds?.length) {
      for (const tagId of payload.tagIds) {
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
    if (payload.tagIds) {
      await ReviewTagRepository.replaceForReview(review.id, payload.tagIds);
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
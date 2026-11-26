"use strict";
/**
 * Service métier des reviews
 */
import { withTransaction } from "../config/database.js";
import ReviewRepository from "../repositories/PgReviewRepository.js";
import ReviewTagRepository from "../repositories/PgReviewTagRepository.js";
import AppEventService from "./AppEventService.js";
import { generateSlug } from "../utils/generateSlug.js";
import { AppError } from "../utils/AppError.js";

class ReviewService {
  static async findAllByUser(userId) {
    return ReviewRepository.findAllByUser(userId);
  }

  // Liste paginée / filtrée (recherche texte, statut, plateforme, tag, note, tri)
  static async search(userId, filters) {
    return ReviewRepository.search(userId, filters);
  }

  // Review d'un utilisateur via son slug (le slug seul ne suffit jamais)
  static async findBySlug(slug, userId) {
    return ReviewRepository.findBySlug(slug, userId);
  }

  static async getTagsByReviewId(reviewId) {
    return (await ReviewTagRepository.findAllByReview(reviewId)) || [];
  }

  // Création d'une review et de ses tags dans une seule transaction
  static async create(userId, gameId, payload) {
    const slug = generateSlug(payload.reviewTitle);
    if (!slug) throw AppError.badRequest("Le titre doit contenir au moins une lettre ou un chiffre.");

    const review = await withTransaction(async (client) => {
      const created = await ReviewRepository.create(
        { ...payload, userId, gameId, slug },
        client,
      );
      await ReviewTagRepository.replaceForReview(created.id, payload.tagIds, userId, client);
      return created;
    });

    await AppEventService.reviewCreated(userId, review.id);
    return review;
  }

  static async update(userId, slug, payload) {
    const review = await ReviewRepository.findBySlug(slug, userId);
    if (!review) throw AppError.notFound("Review introuvable.");

    const data = { ...payload };
    if (payload.reviewTitle) {
      data.slug = generateSlug(payload.reviewTitle);
      if (!data.slug) throw AppError.badRequest("Le titre doit contenir au moins une lettre ou un chiffre.");
    }

    return withTransaction(async (client) => {
      const updated = await ReviewRepository.update(review.id, data, client);
      // Un formulaire d'édition envoie toujours `tagIds` (champ vide si aucun tag coché) :
      // `[]` signifie "retirer tous les tags", `undefined` "ne pas toucher".
      if (payload.tagIds !== undefined) {
        await ReviewTagRepository.replaceForReview(review.id, payload.tagIds, userId, client);
      }
      return updated;
    });
  }

  static async replaceTagsBySlug(userId, slug, tagIds) {
    const review = await ReviewRepository.findBySlug(slug, userId);
    if (!review) throw AppError.notFound("Review introuvable.");

    return ReviewTagRepository.replaceForReview(review.id, tagIds, userId);
  }

  static async deleteReview(userId, slug) {
    const review = await ReviewRepository.findBySlug(slug, userId);
    if (!review) throw AppError.notFound("Review introuvable.");

    // review_tags est supprimé en cascade ; une seule instruction suffit
    return withTransaction((client) => ReviewRepository.delete(review.id, client));
  }
}

export default ReviewService;

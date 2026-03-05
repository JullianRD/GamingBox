"use strict";
/**
 * Service métier Items
 */
import ReviewRepository from "../repositories/PgReviewRepository.js";
import ReviewTagRepository from "../repositories/PgReviewTagRepository.js";
import { generateSlug } from "../utils/generateSlug.js";

class ReviewService {

    // Créer une review avec ses tags associés

    static async create(userId, gameId, payload) {         // Payload = information envoyé par l'utilisateur 
        const slug = generateSlug(payload.title);

        const review = await ReviewRepository.create({
            userId,
            gameId,
            reviewTitle: payload.reviewTitle,
            slug,   // texte mis en forme
            reviewRate: payload.reviewRate,
            reviewLike: payload.reviewLike,
            reviewPlatine: payload.reviewPlatine,
            progressionStatus: payload.progressionStatus,
            avisReview: payload.avisReview,
            gamePlatforme: payload.gamePlatforme
        });

        if (payload.tagIds?.length) {
            for (const tagId of payload.tagIds) {
                await ReviewTagRepository.add(item.id, tagId);
            }
        }

        return review;
    }

    // Modifier une pépite 

    static async update(reviewId, payload) {
        const data = { ...payload };

            // Règle métier légère pour mettre en forme le texte du titre de la review
    if (payload.reviewTitle) {
        data.slug = generateSlug(payload.reviewTitle);
    }

    const item = await ReviewRepository.update(reviewId, data);

        // modifier les tags associé aux reviews
    if (payload.tagIds) {
        await ReviewTagRepository.replaceForReview(reviewId, payload.tagIds);
    }

    return item;
    }

    // Supprimer une review proprement 

    static async delete(reviewId) {
        await ReviewTagRepository.clearForReview(reviewId);
        return ReviewRepository.delete(itemId);
    }
}

export default ReviewService;
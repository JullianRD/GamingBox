"use strict";

import ReviewRepository from "../../repositories/PgReviewRepository.js";

/**
 * Bibliothèque de l'utilisateur : ce qu'il suit, tous types confondus.
 *
 * Provisoire (étape 4) : les entrées sont lues depuis les reviews de jeux
 * existantes. À l'étape 5, ce service lira la table user_items ; le format
 * renvoyé aux vues (entry) ne change pas.
 */

// Statuts historiques de GamingBox vers les statuts génériques de Cocon
const LEGACY_STATUS = {
  "En cour": "in_progress",
  Terminé: "completed",
  Whislist: "planned",
  Dropped: "dropped",
};

export const toEntry = (review) => ({
  id: review.id,
  type: "game",
  title: review.gameTitle,
  href: `/reviews/${review.slug}`,
  coverUrl: review.thumbnailUrl || null,
  status: LEGACY_STATUS[review.progressionStatus] ?? "planned",
  rating: review.reviewRate != null ? Number(review.reviewRate) : null,
  reviewTitle: review.reviewTitle,
  updatedAt: review.updatedAt || review.createdAt,
});

class LibraryService {
  static async getEntries(userId, { type } = {}) {
    const reviews = await ReviewRepository.findAllByUser(userId);
    const entries = reviews.map(toEntry);
    return type ? entries.filter((entry) => entry.type === type) : entries;
  }

  static async getDashboard(userId) {
    const entries = await this.getEntries(userId);
    const byStatus = (status) => entries.filter((entry) => entry.status === status);
    const recentFirst = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);

    return {
      stats: {
        inProgress: byStatus("in_progress").length,
        planned: byStatus("planned").length,
        completed: byStatus("completed").length,
      },
      current: byStatus("in_progress").sort(recentFirst).slice(0, 10),
      recentlyCompleted: byStatus("completed").sort(recentFirst).slice(0, 5),
    };
  }
}

export default LibraryService;

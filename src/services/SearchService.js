"use strict";
/**
 * SearchService
 *
 * Recherche métier dans GamingBox
 *
 */
import ReviewRepository from "../repositories/PgReviewRepository.js";

class SearchService {
  /**
   * 🔍 Recherche globale utilisateur
   *
   * @param {string} userId
   * @param {string} term
   */
  static async search(userId, term) {
    if (!term || term.trim().length < 2) {
      return [];
    }

    return ReviewRepository.search(userId, term.trim());
  }
}

export default SearchService;

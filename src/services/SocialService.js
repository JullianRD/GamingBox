"use strict";

import SocialRepository from "../repositories/PgSocialRepository.js";
import ListRepository from "../repositories/PgListRepository.js";
import { AppError } from "../utils/AppError.js";

class SocialService {
  // Profil privé ou inexistant : même réponse (404), pour ne pas révéler les comptes
  static async getPublicProfile(pseudo, viewerId, page = 1) {
    const profile = await SocialRepository.findPublicProfile(pseudo, viewerId);
    if (!profile) throw AppError.notFound("Profil introuvable.");

    const [reviews, lists] = await Promise.all([
      SocialRepository.publicReviews(profile.id, viewerId, { page }),
      ListRepository.findPublicByUser(profile.id),
    ]);
    return { profile, reviews, lists };
  }

  static async getPublicReview(pseudo, slug, viewerId) {
    const review = await SocialRepository.publicReviewBySlug(pseudo, slug, viewerId);
    if (!review) throw AppError.notFound("Review introuvable.");
    return review;
  }

  static async follow(viewerId, pseudo) {
    const profile = await SocialRepository.findPublicProfile(pseudo, viewerId);
    if (!profile) throw AppError.notFound("Profil introuvable.");
    if (profile.id === viewerId) throw AppError.badRequest("Tu ne peux pas te suivre toi-même.");
    await SocialRepository.follow(viewerId, profile.id);
  }

  static async unfollow(viewerId, pseudo) {
    const profile = await SocialRepository.findPublicProfile(pseudo, viewerId);
    if (!profile) throw AppError.notFound("Profil introuvable.");
    await SocialRepository.unfollow(viewerId, profile.id);
  }

  static feed(viewerId, page) {
    return SocialRepository.feed(viewerId, { page });
  }

  static async toggleLike(viewerId, pseudo, slug) {
    const result = await SocialRepository.toggleLike(viewerId, pseudo, slug);
    if (!result) throw AppError.notFound("Review introuvable.");
    return result;
  }
}

export default SocialService;

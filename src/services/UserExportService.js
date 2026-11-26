"use strict";
import UserRepository from "../repositories/PgUserRepository.js";
import ReviewRepository from "../repositories/PgReviewRepository.js";
import TagRepository from "../repositories/PgTagRepository.js";
import ShareRepository from "../repositories/PgShareRepository.js";

class UserExportService {
  static async export(userId) {
    const [user, reviews, tags, shares] = await Promise.all([
      UserRepository.findById(userId),
      ReviewRepository.findAllByUser(userId),
      TagRepository.findByUserId(userId),
      ShareRepository.findByUserId(userId),
    ]);

    if (!user) return null;

    return {
      user: user.toJSON(),
      reviews,
      tags,
      // Les jetons d'accès ne sont jamais exportés
      shares: (shares || []).map((share) => {
        const copy = { ...share };
        delete copy.shareToken;
        delete copy.share_token;
        return copy;
      }),
      exportDate: new Date().toISOString(),
    };
  }
}

export default UserExportService;

// Ce service sert à :
// Rassembler toutes les données d’un utilisateur pour les exporter.
// Typiquement pour :
// 📦 téléchargement RGPD
// 💾 sauvegarde compte
// 🔄 migration
// 📤 export JSON

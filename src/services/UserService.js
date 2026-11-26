"use strict";

import { AppError } from "../utils/AppError.js";
import UserRepository from "../repositories/PgUserRepository.js";

// Gestion du compte utilisateur (profil de l'utilisateur connecté)

class UserService {
  // Permet d'afficher le profil de l'utilisateur
  static async getProfileById(userId) {
    if (!userId) {
      throw new Error("Utilisateur non authentifié.");
    }

    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new Error("Utilisateur introuvable.");
    }

    return user;
  }

  // Récupérer un profil par son Id

  static async getById(userId) {
    return UserRepository.findById(userId);
  }

  static async getAllUserById(userId) {
    return UserRepository.findAllAdmin(userId);
  }

  // Mettre à jour le profil (les données arrivent déjà validées par Zod)
  static async updateProfile(userId, data, avatarPath = null) {
    const currentUser = await UserRepository.findById(userId);

    if (!currentUser) {
      throw AppError.notFound("Utilisateur introuvable.");
    }

    // CITEXT : la comparaison est insensible à la casse ; on exclut l'utilisateur lui-même
    if (data.pseudo !== currentUser.pseudo && (await UserRepository.existByPseudo(data.pseudo))) {
      throw AppError.conflict("Ce pseudo est déjà utilisé.");
    }

    return UserRepository.update(userId, {
      pseudo: data.pseudo,
      avatar: avatarPath || currentUser.avatar || null,
      biographie: data.biographie ?? "",
      profilePublic: Boolean(data.profilePublic),
    });
  }

  // Mettre à jour les préférences utilisateurs
  static async updateSettings(userId, settings) {
    return UserRepository.updateSettings(userId, settings);
  }

  // Suppression définitive du compte (RGPD)

  static async deleteAccount(userId) {
    return UserRepository.delete(userId);
  }
}

export default UserService;

// Faire userRepository.updateAvatar(userId, avatarPath) (et avatar dans la table utilisateur)

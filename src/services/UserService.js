"use strict";

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

  // Mettre à jour une info ou plusieurs du profil utilisateur
  static async updateProfile(userId, data, avatarPath = null) {
    const currentUser = await UserRepository.findById(userId);

    if (!currentUser) {
      throw new Error("Utilisateur introuvable.");
    }

    const pseudo = data.pseudo?.trim();
    const biographie = data.biographie?.trim() || null;

    if (!pseudo) {
      throw new Error("Le pseudo est requis.");
    }

    const pseudoAlreadyUsed = await UserRepository.existByPseudo(pseudo);

    if (
      pseudoAlreadyUsed &&
      pseudo.toLowerCase() !== currentUser.pseudo?.toLowerCase()
    ) {
      throw new Error("Ce pseudo est déjà utilisé.");
    }

    const avatar = avatarPath || currentUser.avatar || null;

    return UserRepository.update(userId, {
      pseudo,
      avatar,
      biographie,
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
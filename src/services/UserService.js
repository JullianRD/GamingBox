"use strict"

// Gestion du compte utilisateur (profil de l'utilisateur connecté)

class UserService {

    // Récupérer un profil par son Id

    static async getById(userId) {
        return UserRepository.findById(userId);
    }


    // Mettre à jour une info ou plusieurs du profil utilisateur
    static async updateProfil(userId, data) {
        if (await UserRepository.existByPseudo(pseudo)) {
            throw new Error("Ce pseudo est déjà utilisé.")
        }
        return UserRepository.update(userId, data);
    }

    // Mettre à jour les préférences utilisateurs
    static async updateSettings(userId, settings) {
        return UserRepository.updateSettings(userId, settings);
    }

    // Suppression définitive du compte (RGPD)

    static async deleteAccount(userId) {
        return UserRepository.delete(userId)
    }
}

export default UserService;


// Faire userRepository.updateAvatar(userId, avatarPath) (et avatar dans la table utilisateur)
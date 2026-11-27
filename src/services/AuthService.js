"use strict";
import db from "../config/database.js";

import UserRepository from "../repositories/PgUserRepository.js";
import { hashPassword, verifyPassword } from "../utils/passwordHelper.js";

// Gestion de l'authentification de l'utilisateur 

class AuthService {

    // Cas métier : inscription 

    static async register({ email, password, pseudo, gdprConsent }) {
        if (await UserRepository.existByEmail(email)) {
            throw new Error("Cet email est déjà utilisé")
        }
        if (await UserRepository.existByPseudo(pseudo)) {
            throw new Error("Ce pseudo est déjà utilisé.")
        }

        const passwordHash = await hashPassword(password);

        return UserRepository.create({
            email,
            passwordHash,
            pseudo,
            gdprConsent: gdprConsent === "on",
            authProvider: "local",
        });
    }

    // Cas métier : connexion 

    static async login({ email, password }) {
        const user = await UserRepository.findByEmail(email);
    if (!user || user.authProvider !== "local") {
        throw new Error("Identifiants invalides.");
    }

    const isValid = await verifyPassword(user.passwordHash, password);

    if (!isValid) {
        throw new Error("Identifiants invalides.");
    }

    if (user.suspendedAt) {
        throw new Error("Ce compte est suspendu. Écris-nous si tu penses que c'est une erreur.");
    }

    await db.query("UPDATE users SET last_login_at = NOW() WHERE id_user = $1", [user.id]);
    return user;
    }
}

export default AuthService;
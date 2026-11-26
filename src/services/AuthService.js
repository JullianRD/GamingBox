"use strict";

import db from "../config/database.js";
import UserRepository from "../repositories/PgUserRepository.js";
import { hashPassword, verifyPassword, verifyDummyPassword } from "../utils/passwordHelper.js";
import { isPasswordPwned } from "../utils/passwordPolicy.js";
import { AppError } from "../utils/AppError.js";
import TokenService, { TOKEN_TYPES } from "./TokenService.js";
import MailService from "./MailService.js";
import AppEventService from "./AppEventService.js";

const INVALID_CREDENTIALS = "Identifiants invalides.";

/** Authentification et cycle de vie du compte (inscription, vérification, reset). */
class AuthService {
  static async register({ email, password, pseudo, gdprConsent }) {
    if (await UserRepository.existByEmail(email)) {
      throw AppError.conflict("Cet email est déjà utilisé.");
    }
    if (await UserRepository.existByPseudo(pseudo)) {
      throw AppError.conflict("Ce pseudo est déjà utilisé.");
    }
    if (await isPasswordPwned(password)) {
      throw AppError.badRequest(
        "Ce mot de passe figure dans des fuites de données connues. Choisis-en un autre.",
      );
    }

    const user = await UserRepository.create({
      email,
      passwordHash: await hashPassword(password),
      pseudo,
      gdprConsent,
      authProvider: "local",
    });

    await this.sendVerificationEmail(user);
    await AppEventService.userRegistered(user.id);
    return user;
  }

  static async login({ email, password }) {
    const user = await UserRepository.findByEmail(email);

    if (!user || user.authProvider !== "local") {
      await verifyDummyPassword(password); // temps de réponse constant
      throw new AppError(INVALID_CREDENTIALS, 401, "INVALID_CREDENTIALS");
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new AppError(INVALID_CREDENTIALS, 401, "INVALID_CREDENTIALS");
    }

    return user;
  }

  static async sendVerificationEmail(user) {
    const token = await TokenService.issue(user.id, TOKEN_TYPES.EMAIL_VERIFY);
    await MailService.sendVerification(user, token);
  }

  static async resendVerification(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) throw AppError.notFound("Utilisateur introuvable.");
    if (user.emailVerifiedAt) return false;
    await this.sendVerificationEmail(user);
    return true;
  }

  static async verifyEmail(token) {
    const userId = await TokenService.consume(token, TOKEN_TYPES.EMAIL_VERIFY);
    if (!userId) throw AppError.badRequest("Lien de confirmation invalide ou expiré.");
    await UserRepository.markEmailVerified(userId);
    return userId;
  }

  /** Répond toujours sans erreur : ne révèle pas si l'email existe. */
  static async requestPasswordReset(email) {
    const user = await UserRepository.findByEmail(email);
    if (!user || user.authProvider !== "local") return;

    const token = await TokenService.issue(user.id, TOKEN_TYPES.PASSWORD_RESET);
    await MailService.sendPasswordReset(user, token);
  }

  static isResetTokenValid(token) {
    return TokenService.peek(token, TOKEN_TYPES.PASSWORD_RESET);
  }

  static async resetPassword(token, newPassword) {
    if (await isPasswordPwned(newPassword)) {
      throw AppError.badRequest(
        "Ce mot de passe figure dans des fuites de données connues. Choisis-en un autre.",
      );
    }

    const userId = await TokenService.consume(token, TOKEN_TYPES.PASSWORD_RESET);
    if (!userId) throw AppError.badRequest("Lien de réinitialisation invalide ou expiré.");

    await UserRepository.updatePassword(userId, await hashPassword(newPassword));
    // Une réinitialisation prouve la possession de l'email, et coupe toutes les sessions ouvertes
    await UserRepository.markEmailVerified(userId);
    await this.revokeSessions(userId);
    return userId;
  }

  /** Supprime toutes les sessions serveur d'un utilisateur. */
  static async revokeSessions(userId) {
    await db.query("DELETE FROM user_sessions WHERE sess->>'userId' = $1", [userId]);
  }
}

export default AuthService;

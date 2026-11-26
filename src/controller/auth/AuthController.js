"use strict";

import AuthService from "../../services/AuthService.js";
import AppEventService from "../../services/AppEventService.js";
import {
  regenerateSession,
  saveSession,
  destroySession,
  SESSION_COOKIE_NAME,
} from "../../config/session.js";

/**
 * Les AppError (erreurs métier) sont affichées à l'utilisateur ; toute autre
 * erreur remonte au handler global (500 générique, détails dans les logs).
 */
const flashOrThrow = (req, error, fallbackRedirect, res) => {
  if (!error?.isOperational) throw error;
  req.flash("error", error.message);
  return res.redirect(fallbackRedirect);
};

class AuthController {
  showRegister(req, res) {
    res.render("pages/auth/register", {
      title: "Inscription à GamingBox",
      flash: res.locals.flash || {},
    });
  }

  async handleRegister(req, res) {
    try {
      await AuthService.register(req.body);
      res.locals.authOk = true;
      req.flash("success", "Compte créé. Un email de confirmation vient de t'être envoyé.");
      return res.redirect("/login");
    } catch (error) {
      return flashOrThrow(req, error, "/register", res);
    }
  }

  showLogin(req, res) {
    res.render("pages/auth/login", {
      title: "Connexion à GamingBox",
      flash: res.locals.flash || {},
      logoutSuccess: false,
    });
  }

  async handleLogin(req, res) {
    let user;
    try {
      user = await AuthService.login(req.body);
    } catch (error) {
      await AppEventService.authFailure({ ip: req.ip });
      return flashOrThrow(req, error, "/login", res);
    }

    // Nouvelle session à chaque connexion : empêche la fixation de session
    await regenerateSession(req);

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.pseudo = user.pseudo;
    req.session.roleName = user.roleName;
    req.session.avatar = user.avatar;
    req.session.emailVerified = Boolean(user.emailVerifiedAt);
    req.session.csrfBound = true;

    req.flash("success", `Bienvenue ${user.pseudo}`);
    await saveSession(req);

    res.locals.authOk = true;
    await AppEventService.authSuccess(user.id, { ip: req.ip });

    return res.redirect(["admin", "super_admin"].includes(user.roleName) ? "/admin" : "/reviews");
  }

  async logout(req, res) {
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.redirect("/login");
  }

  // --- Vérification de l'adresse email ---------------------------------------

  async verifyEmail(req, res) {
    try {
      const userId = await AuthService.verifyEmail(req.params.token);
      if (req.session?.userId === userId) req.session.emailVerified = true;
      req.flash("success", "Adresse email confirmée.");
    } catch (error) {
      if (!error?.isOperational) throw error;
      req.flash("error", error.message);
    }
    return res.redirect(req.session?.userId ? "/profile" : "/login");
  }

  async resendVerification(req, res) {
    const sent = await AuthService.resendVerification(req.session.userId);
    req.flash(
      "success",
      sent ? "Email de confirmation renvoyé." : "Ton adresse est déjà confirmée.",
    );
    return res.redirect("/profile");
  }

  // --- Mot de passe oublié ----------------------------------------------------

  showForgotPassword(req, res) {
    res.render("pages/auth/forgot-password", {
      title: "Mot de passe oublié - GamingBox",
      flash: res.locals.flash || {},
    });
  }

  async handleForgotPassword(req, res) {
    await AuthService.requestPasswordReset(req.body.email);
    // Même réponse que l'email existe ou non
    req.flash(
      "success",
      "Si un compte correspond à cette adresse, un email de réinitialisation vient d'être envoyé.",
    );
    return res.redirect("/login");
  }

  async showResetPassword(req, res) {
    const valid = await AuthService.isResetTokenValid(req.params.token);
    if (!valid) {
      req.flash("error", "Lien de réinitialisation invalide ou expiré.");
      return res.redirect("/forgot-password");
    }
    return res.render("pages/auth/reset-password", {
      title: "Nouveau mot de passe - GamingBox",
      token: req.params.token,
      flash: res.locals.flash || {},
    });
  }

  async handleResetPassword(req, res) {
    try {
      await AuthService.resetPassword(req.params.token, req.body.password);
      res.locals.authOk = true;
      req.flash("success", "Mot de passe modifié. Tu peux te connecter.");
      return res.redirect("/login");
    } catch (error) {
      return flashOrThrow(
        req,
        error,
        `/reset-password/${encodeURIComponent(req.params.token)}`,
        res,
      );
    }
  }
}

export default new AuthController();

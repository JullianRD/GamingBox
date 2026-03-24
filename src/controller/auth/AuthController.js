"use strict";

import AuthService from "../../services/AuthService.js";
import { generateToken } from "../../config/security.js";
import { SESSION_COOKIE_NAME } from "../../config/session.js";

class AuthController {
  // Affiche la page d'inscription à l'App

  async showRegister(req, res) {
    res.render("pages/auth/register", {
      title: "Inscription à GamingBox",
      csrfToken: generateToken(req, res),
      flash: res.locals.flash || {},
    });
  }

  // Traite la réussite ou l'echec de l'inscription

  async handleRegister(req, res) {
    try {
      await AuthService.register(req.body);

      req.flash("success", "Compte créé avec succès ✅");
      return res.redirect("/login");
    } catch (error) {
      req.flash("error", error.message);
      return res.redirect("/register");
    }
  }

  // Affiche la page de connexion à l'App

  async showLogin(req, res) {
    res.render("pages/auth/login", {
      title: "Connexion à l'APP GamingBox",
      csrfToken: req.csrfToken(),
      logoutSuccess: req.query.logout === "1",
      flash: res.locals.flash || {},
    });
  }

  // Traite la connexion à l'App

  async handleLogin(req, res) {
    try {
      const user = await AuthService.login(req.body);

      console.log("LOGIN USER:", user);
      console.log("LOGIN USER ID:", user.id);
      console.log("LOGIN USER ID_USER:", user.id_user);

      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.pseudo = user.pseudo;
      req.session.roleName = user.roleName;
      req.session.avatar = user.avatar;

      console.log("SESSION USER ID SET:", req.session.userId);

      req.flash("success", `Bienvenue ${user.pseudo} 👋`);

      return req.session.save((err) => {
        if (err) {
          console.error("SESSION SAVE ERROR:", err);
          req.flash("error", "Impossible d'enregistrer la session.");
          return res.redirect("/login");
        }

        return res.redirect("/reviews");
      });
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      req.flash("error", error.message || "Erreur lors de la connexion.");
      return res.redirect("/login");
    }
  }

  // Déconnexion à l'App

  async logout(req, res) {
    try {
      const sessionId = req.sessionID;

      console.log("LOGOUT HIT");
      console.log("LOGOUT SESSION ID:", sessionId);

      if (!sessionId) {
        res.clearCookie(SESSION_COOKIE_NAME, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        return res.redirect("/login?logout=1");
      }

      req.sessionStore.destroy(sessionId, (error) => {
        if (error) {
          console.error("LOGOUT STORE DESTROY ERROR:", error);
          return res.redirect("/reviews");
        }

        res.clearCookie(SESSION_COOKIE_NAME, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });

        return res.redirect("/login?logout=1");
      });
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      return res.redirect("/reviews");
    }
  }
}

export default new AuthController();
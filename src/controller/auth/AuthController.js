"use strict";

import AuthService from "../../services/AuthService.js";
import { generateToken } from "../../config/security.js";

class AuthController {

    // Affiche la page d'inscription à l'App

    async showRegister(req, res) {
        res.render("pages/auth/register", {
            title: "Inscription à GamingBox",
            csrfToken: generateToken(req, res),
        });
    }

    // Traite la réussite ou l'echec de l'inscription 
    
async handleRegister(req, res) {
  try {
    await AuthService.register(req.body);

    req.flash("success", "Compte créé avec succès ✅");
    res.redirect("/auth/login");
  } catch (error) {
    req.flash("error", error.message);
    res.redirect("/auth/register");
  }
}

    // Affiche la page de connexion à l'App

  async showLogin(req, res) {
    res.render("pages/auth/login", {
      title: "Connexion à l'APP GamingBox",
      csrfToken: req.csrfToken(),
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
    req.session.destroy(() => {          // J'ai un doute si ça marche comme ça donc à re vérifier (la fonction destroy est any)
        res.redirect("/auth/login");
    })
  }
}

export default new AuthController();
"use strict";

import AuthService from "../../services/AuthService.js";

class AuthController {

    // Affiche la page d'inscription à l'App

    async showRegister(req, res) {
        res.render("pages/auth/register", {
            title: "Inscription à GamingBox",
            csrfToken: req.csrfToken(),
        });
    }

    // Traite la réussite ou l'echec de l'inscription 
    
    async handleRegister(req, res) {
        try {
            await AuthService.register(req.body);
            
            req.flash("Compte créé avec succès ✅")
            res.redirect("/auth/login")
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
        const user = await AuthService.login(req.body)

      req.session.userId = user.id;
      req.flash("success", `Bienvenue ${user.pseudo} 👋`);
      res.redirect("/reviews")
    } catch (error) {
        req.flash("error", error.message);
        res.redirect("/auth/login");
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
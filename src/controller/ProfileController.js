"use strict";

import UserService from "../services/UserService.js";
import UserExportService from "../services/UserExportService.js";
import { generateToken } from "../config/security.js";
// import UserDTO from "../dto/UserDTO.js";

// Gestion du profil de l'utilisateur connecté

class ProfileController {

    // Permet d'afficher le profil de l'utilisateur
  async index(req, res) {
    try {
      const user = await UserService.getProfileById(req.session.userId);

      return res.render("pages/profile/index", {
        title: "Mon profil - GamingBox",
        user,
      });
    } catch (error) {
      console.error("PROFILE INDEX ERROR:", error);
      req.flash("error", error.message || "Impossible de charger le profil.");
      return res.redirect("/reviews");
    }
  }

    // Affiche le formulaire de modification du profil

async edit(req, res) {
  const user = await UserService.getProfileById(req.session.userId);

  res.render("pages/profile/edit", {
    title: "Modifier mon profil",
    user,
    csrfToken: generateToken(req, res),
  });
}

    // Mettre à jour le profil de l'utilisateur

async update(req, res) {
  try {
    const userId = req.session.userId;

    const updatedUser = await UserService.updateProfile(userId, req.body);

    req.session.email = updatedUser.email;
    req.session.pseudo = updatedUser.pseudo;
    req.session.roleName = updatedUser.roleName;
    req.session.avatar = updatedUser.avatar;

    req.flash("success", "Profil mis à jour ✅");

    return req.session.save((err) => {
      if (err) {
        console.error("SESSION SAVE ERROR:", err);
        req.flash("error", "Le profil a été modifié, mais la session n'a pas pu être mise à jour.");
        return res.redirect("/profile");
      }

      return res.redirect("/profile");
    });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    req.flash("error", error.message || "Impossible de mettre à jour le profil.");
    return res.redirect("/profile/edit");
  }
}

    async destroy(req, res) {
        try {
            const userId = req.session.userId;

            await UserService.deleteAccount(userId);

            req.session.destroy(() => {
                res.redirect("pages/auth/register");
            });
        } catch (error) {
            req.flash("error", error.message);
            res.redirect("pages/profile");
        }
    }

      /**
   * Export RGPD des données utilisateur
   */
  async export(req, res) {
    const userId = req.session.userId;

    const data = await UserExportService.export(userId);

    if (!data) {
      return res.status(404).render("pages/errors/404");
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=memoria-export-${userId}.json`,
    );
    res.setHeader("Content-Type", "application/json");

    res.send(JSON.stringify(data, null, 2));
  }
}

export default new ProfileController();
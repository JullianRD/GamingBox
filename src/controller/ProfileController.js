"use strict";

import UserService from "../services/UserService.js";
import UserExportService from "../services/UserExportService.js";
// import UserDTO from "../dto/UserDTO.js";

// Gestion du profil de l'utilisateur connecté

class ProfileController {
    async show(req, res) {
        const userId = req.session.userId;

        const user = await UserService.getById(userId);
        if (!user) {
            return res.status(404).render("error/404");
        }

        res.render("pages/auth/profile", {
            title: "Mon profil - GamingBox",
            user: UserDTO.fromEntity(user),
        });
    }

    // Mettre à jour le profil de l'utilisateur

    async update(req, res) {
        try {
            const userId = req.session.userId;

            await UserService.updateProfile(userId, req.body);
            req.flash("success", "Profil mis à jour ✅");
            res.redirect("pages/profile");
        } catch (error) {
            req.flash("error", error.message);
            res.redirect("page/profile");
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
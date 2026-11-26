"use strict";

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import UserService from "../services/UserService.js";
import UserExportService from "../services/UserExportService.js";
import SocialService from "../modules/social/SocialService.js";
import { SESSION_COOKIE_NAME } from "../config/session.js";
import { logger } from "../config/logger.js";

// Compte de l'utilisateur connecté : réglages, confidentialité, export et suppression

class ProfileController {
  // Le profil se consulte sur sa page publique
  async index(req, res) {
    res.redirect(`/u/${encodeURIComponent(req.session.pseudo)}`);
  }

  async edit(req, res, next) {
    try {
      const user = await UserService.getProfileById(req.session.userId);
      res.render("pages/profile/settings", { title: "Mon compte - Cocon", user });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res) {
    try {
      const userId = req.session.userId;
      let avatarPath = null;

      if (req.file) {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
        fs.mkdirSync(uploadDir, { recursive: true });
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
        await sharp(req.file.buffer)
          .resize(400, 400, { fit: "cover", position: "center" })
          .webp({ quality: 82 })
          .toFile(path.join(uploadDir, filename));
        avatarPath = `/uploads/avatars/${filename}`;
      }

      const updatedUser = await UserService.updateProfile(userId, req.body, avatarPath);
      req.session.pseudo = updatedUser.pseudo;
      req.session.avatar = updatedUser.avatar;
      req.flash("success", "Profil mis à jour.");
      return req.session.save(() => res.redirect("/profile/edit"));
    } catch (error) {
      logger.warn({ err: error }, "Mise à jour du profil impossible");
      req.flash("error", error.message || "Impossible de mettre à jour le profil.");
      return res.redirect("/profile/edit");
    }
  }

  async privacy(req, res, next) {
    try {
      const isPublic = req.body.isPublic === "true";
      await SocialService.setPublic(req.session.userId, isPublic);
      req.flash("success", isPublic ? "Ton profil est public." : "Ton profil est privé.");
      res.redirect("/profile/edit");
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await UserService.deleteAccount(req.session.userId);
      req.session.destroy(() => {
        res.clearCookie(SESSION_COOKIE_NAME);
        res.redirect("/register");
      });
    } catch (error) {
      next(error);
    }
  }

  // Export RGPD des données utilisateur
  async export(req, res, next) {
    try {
      const data = await UserExportService.export(req.session.userId);
      if (!data) return next();
      res.setHeader("Content-Disposition", `attachment; filename=cocon-export-${data.user.pseudo}.json`);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(data, null, 2));
    } catch (error) {
      next(error);
    }
  }
}

export default new ProfileController();

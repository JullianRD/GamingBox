"use strict";

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import UserService from "../services/UserService.js";
import UserExportService from "../services/UserExportService.js";
import ShareService from "../services/ShareService.js";
import AppEventService from "../services/AppEventService.js";
import { regenerateSession, saveSession } from "../config/session.js";
import { AppError } from "../utils/AppError.js";
import { deleteFile } from "../utils/uploadHelper.js";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

/** Gestion du profil de l'utilisateur connecté. */
class ProfileController {
  async index(req, res) {
    const userId = req.session.userId;
    const user = await UserService.getProfileById(userId);
    const profileShares = await ShareService.findProfileSharesByUserId(userId);

    return res.render("pages/profile/index", {
      title: "Mon profil - GamingBox",
      user,
      profileShares: profileShares || [],
      flash: res.locals.flash || {},
    });
  }

  async edit(req, res) {
    const user = await UserService.getProfileById(req.session.userId);

    res.render("pages/profile/edit", {
      title: "Modifier mon profil",
      user,
      flash: res.locals.flash || {},
    });
  }

  async update(req, res) {
    const userId = req.session.userId;
    let avatarPath = null;
    let newAvatarFile = null;

    try {
      // Le fichier est ré-encodé par sharp : seul un vrai fichier image est conservé (WebP, 400x400)
      if (req.file) {
        await fs.mkdir(AVATAR_DIR, { recursive: true });

        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
        try {
          // Formats décodés limités à JPEG / PNG / WebP (et taille bornée), quel que soit le type MIME déclaré
          const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000, failOn: "error" });
          const { format } = await image.metadata();
          if (!["jpeg", "png", "webp"].includes(format)) throw new Error("format non autorisé");

          await image
            .resize(400, 400, { fit: "cover", position: "center" })
            .webp({ quality: 82 })
            .toFile(path.join(AVATAR_DIR, filename));
        } catch {
          throw AppError.badRequest(
            "Le fichier envoyé n'est pas une image valide (JPEG, PNG ou WebP).",
          );
        }

        avatarPath = `/uploads/avatars/${filename}`;
        newAvatarFile = avatarPath;
      }

      const previous = await UserService.getProfileById(userId);
      const updatedUser = await UserService.updateProfile(userId, req.body, avatarPath);

      // Ancien avatar supprimé du disque une fois le nouveau enregistré
      if (avatarPath && previous?.avatar && previous.avatar !== avatarPath) {
        await deleteFile(previous.avatar);
      }

      req.session.pseudo = updatedUser.pseudo;
      req.session.avatar = updatedUser.avatar;

      req.flash("success", "Profil mis à jour");
      await saveSession(req);
      return res.redirect("/profile");
    } catch (error) {
      if (newAvatarFile) await deleteFile(newAvatarFile);
      if (!error?.isOperational) throw error;
      req.flash("error", error.message);
      return res.redirect("/profile/edit");
    }
  }

  async destroy(req, res) {
    const userId = req.session.userId;

    const user = await UserService.getProfileById(userId);
    await UserService.deleteAccount(userId);

    // RGPD : le fichier d'avatar est supprimé avec le compte
    if (user?.avatar) await deleteFile(user.avatar);
    await AppEventService.gdprDelete(userId);

    // Nouvelle session vide (la session de l'ancien compte est détruite)
    await regenerateSession(req);
    req.flash("success", "Ton compte et tes données ont été supprimés.");
    await saveSession(req);
    return res.redirect("/register");
  }

  /** Export RGPD des données personnelles (JSON). */
  async export(req, res) {
    const userId = req.session.userId;
    const data = await UserExportService.export(userId);

    if (!data) throw AppError.notFound("Compte introuvable.");

    await AppEventService.gdprExport(userId);

    res.setHeader("Content-Disposition", `attachment; filename=gamingbox-export-${userId}.json`);
    res.type("application/json").send(JSON.stringify(data, null, 2));
  }
}

export default new ProfileController();

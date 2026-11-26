"use strict";

import LibraryService from "./LibraryService.js";
import { getItemTypeByPath, STATUSES } from "../../utils/itemTypes.js";

class LibraryController {
  // Accueil connecté ; un visiteur passe à la page d'accueil publique
  async home(req, res, next) {
    if (!req.session.userId) return next();
    try {
      const dashboard = await LibraryService.getDashboard(req.session.userId);
      // Date et salutation à l'heure française
      const now = new Date();
      const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now));
      const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
      res.render("pages/library/home", {
        title: "Accueil - Cocon",
        greeting: hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir",
        today: date.charAt(0).toUpperCase() + date.slice(1),
        ...dashboard,
      });
    } catch (error) {
      next(error);
    }
  }

  // Vue d'ensemble de la bibliothèque, par catégorie
  async library(req, res, next) {
    try {
      const overview = await LibraryService.getOverview(req.session.userId);
      res.render("pages/library/index", { title: "Ma bibliothèque - Cocon", overview });
    } catch (error) {
      next(error);
    }
  }

  // Section par type : /jeux, /films
  async section(req, res, next) {
    const itemType = getItemTypeByPath(req.path);
    if (!itemType || !itemType.enabled) return next();

    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    try {
      const section = await LibraryService.getSection(req.session.userId, itemType.code, status);
      res.render("pages/library/section", {
        title: `${itemType.plural} - Cocon`,
        section: itemType.code,
        itemType,
        status,
        ...section,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new LibraryController();

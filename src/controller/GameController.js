"use strict";

import GameService from "../services/GameService.js";

// GameController
// Gestion des jeux en base locale + import IGDB

class GameController {
  async index(req, res) {
    try {
      const games = await GameService.findAllByGameId();
      return res.render("games/index", { games });
    } catch (error) {
      console.error("GAME INDEX ERROR:", error);
      req.flash("error", "Impossible de charger les jeux.");
      return res.redirect("/reviews");
    }
  }

  // Détails d'un jeu
  async show(req, res) {
    try {
      const game = await GameService.findById(req.params.id);

      if (!game) {
        return res.status(404).render("pages/errors/404");
      }

      return res.render("games/show", { game });
    } catch (error) {
      console.error("GAME SHOW ERROR:", error);
      req.flash("error", "Impossible de charger le jeu.");
      return res.redirect("/reviews");
    }
  }

  // Recherche de jeux via IGDB
  async searchIgdb(req, res) {
    try {
      const query = req.query.q || "";
      const games = await GameService.searchIgdbGames(query);
      return res.json({ games });
    } catch (error) {
      console.error("IGDB SEARCH ERROR:", error);
      return res.status(500).json({
        error: error.message || "Impossible de rechercher des jeux sur IGDB.",
      });
    }
  }

  // Import d'un jeu depuis IGDB en base locale
  async importFromIgdb(req, res) {
    try {
      const { igdbId } = req.body;

      if (!igdbId) {
        return res.status(400).json({ error: "igdbId requis." });
      }

      const game = await GameService.getOrCreateByIgdbId(igdbId);

      return res.json({
        success: true,
        game,
      });
    } catch (error) {
      console.error("IGDB IMPORT ERROR:", error);
      return res.status(500).json({
        error: error.message || "Impossible d'importer le jeu depuis IGDB.",
      });
    }
  }

  // Stocke le jeu dans la base de donnée
  async store(req, res) {
    try {
      await GameService.create(req.body);
      req.flash("success", "Jeu créé avec succès");
      return res.redirect("/games");
    } catch (error) {
      console.error("GAME STORE ERROR:", error);
      req.flash("error", "Impossible de créer le jeu.");
      return res.redirect("/games");
    }
  }

  // Ouvre le formulaire d'édition du jeu en local
  async edit(req, res) {
    try {
      const game = await GameService.findById(req.params.id);

      if (!game) {
        return res.status(404).render("pages/errors/404");
      }

      return res.render("games/edit", { game });
    } catch (error) {
      console.error("GAME EDIT ERROR:", error);
      req.flash("error", "Impossible de charger le jeu.");
      return res.redirect("/games");
    }
  }

  // Mise à jour du jeu en local
  async update(req, res) {
    try {
      await GameService.update(req.params.id, req.body);
      req.flash("success", "Le jeu a été mis à jour");
      return res.redirect("/games");
    } catch (error) {
      console.error("GAME UPDATE ERROR:", error);
      req.flash("error", "Impossible de mettre à jour le jeu.");
      return res.redirect("/games");
    }
  }

  async destroy(req, res) {
    try {
      await GameService.delete(req.params.id);
      req.flash("success", "Le jeu a bien été supprimé");
      return res.redirect("/games");
    } catch (error) {
      console.error("GAME DELETE ERROR:", error);
      req.flash("error", "Impossible de supprimer le jeu.");
      return res.redirect("/games");
    }
  }
}

export default new GameController();
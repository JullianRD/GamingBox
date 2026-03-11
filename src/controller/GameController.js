"use strict"

import GameService from "../services/GameService.js"

// GameController 

// Gestion des jeux en base de données local (reservé aux ADMINS)

// Liste de tout les jeux en base

class GameController {
    async index(req, res) {
        const games = await GameService.findAllByGameId(req.game.id)
        res.render("games/index", { games });
    }

    // Détails d'un jeu

    async show(req, res) {
        const games = await GameService.findById(req.game.id)

        if (!games) {
            return res.status(404).render("error/404");
        }
        res.render("games/show", { games })
    }

    // Stocke le jeu dans la base de donnée
    async store(req, res) {
        await GameService.create(req.user.id, req.body.gameTitle);
        req.flash("success", "jeu créer avec succés")
        res.redirect("pages/games/index")
    }

    // Ouvre le formulaire d'édition du jeu en local

    async edit(req, res) {
        const game = await GameService.findById(req.game.id);

        if (!game) {
            return res.status(404).render("error/404");
        }
        res.render("games/edit", { game });
    }

    // Mise à jour du jeu en local

    async update(req, res) {
        await GameService.update(req.game.id, req.body);
        req.flash("Le jeu à été mis à jour");
        res.redirect("games/index");
    }

    async destroy(req, res) {
        await GameService.deleteGame(req.game.id);
        req.flash("Le jeu à bien été supprimé");
        res.redirect("games/index");
    }
}

export default new GameController();
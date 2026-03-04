"use strict"

import Gameservice from "../services/GameService.js"
import PgGameRepository from "../repositories/PgGameRepository.js"

// GameController 

// Gestion des jeux en base de données local (reservé aux ADMINS)

// Liste de tout les jeux en base

class GameController {
    async index(req, res) {
        const games = await PgGameRepository.findAllByGameId(req.game.id)
        res.render("games/index", { games });
    }

    // Détails d'un jeu

    async show(req, res) {
        const games = await PgGameRepository.findById(req.game.id)

        if (!games) {
            return res.status(404).render("error/404");
        }
        res.render("games/show", { games })
    }

    // Ouvre le formulaire d'édition du jeu en local

    async edit(req, res) {
        const game = await PgGameRepository.findById(req.game.id);

        if (!game) {
            return res.status(404).render("error/404");
        }
        res.render("games/edit", { game });
    }

    // Mise à jour du jeu en local

    async update(req, res) {
        await Gameservice.update(req.game.id, req.body);
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
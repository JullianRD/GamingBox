"use strict";

import TagRepository from "../repositories/PgTagRepository.js";
import TagService from "../services/TagService.js";

// TagController / Le rendu des tags sur les review se fait directement depuis le reviewController !

class TagController {
    
    // Liste complète des tags de l'utilisateur

    async index(req, res) {
        const tags = await TagService.findByUserId(req.user.id);
        res.render("pages/tags/index", { tags });
    }

    // Détails d'un tag
    async show(req, res) {
        const tag = await TagService.findById(req.params.id);

        if (!tag) {
            return res.status(404).render("pages/error/404")
        }

        res.render("pages/tags/show0", { tag });
    }

    // Formulaire de création du tag
    new(req, res) {
        res.render("pages/tags/new")
    }

    async store(req, res) {
        await TagService.create(req.user.id, req.body.tagName);
        req.flash("success", "Tag crée avec succés")
        res.redirect("pages/tags/index")
    }

// Formulaire de modification du tag
    async edit(req, res) {
        const tag = await TagService.findById(req.params.id)

        if (!tag) {
            return res.status(404).render("pages/errors/404")
        }
        res.render("pages/tags/edit", { tag });
    }

    // Mise à jour d'un tag 

    async update(req, res) {
        await TagService.update(req.params.id, req.user.id, req.body.tagName);
        req.flash("success", "Le Tag à bien été mis à jour");
        res.redirect(`/tags/${req.params.id}`);
    }

    // Suppression d'un Tag

    async destroy(req, res) {
        await TagService.delete(req.params.id, req.user.id)
        res.flash("success", "Le Tag à été supprimé avec succès");
        res.redirect("pages/tags/index")
    }
}

export default new TagController();
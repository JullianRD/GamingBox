"use strict"
import TagRepository from "../repositories/PgTagRepository.js"

// TagService : Logique métier lié aux tags utilisateurs (centralise les règles métiers liées aux tags)
// à mettre à jour pour mettre les divers règles métiers associé aux reviews


class TagService {

    // Créer un tag lié à un utilisateur

    static async create(userId, tagName) {
        return TagRepository.create({
            userId,
            tagName
        });
    }

    static async findByUserId(userId) {
        if (!userId) {
            throw new error("UserId requis")
        }
        return await TagRepository.findByUserId(userId)
    }

    static async findById(userId) {
        if (!userId) {
            throw new error("UserId requis")
        }
        return await TagRepository.findById(userId)
    }

    // renommer un tag 
    static async update(tagId, tagName) {
        return TagRepository.update(tagId, { tagName });
    }

    // Supprimer un tag 

    static async delete(tagId) {
        return TagRepository.delete(tagId);
    }
}

export default TagService;
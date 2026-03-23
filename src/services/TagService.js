"use strict";
import TagRepository from "../repositories/PgTagRepository.js";

// TagService : Logique métier lié aux tags utilisateurs (centralise les règles métiers liées aux tags)
// à mettre à jour pour mettre les divers règles métiers associé aux reviews

class TagService {
  // Créer un tag lié à un utilisateur

  static async create(userId, tagName) {
    if (!userId) {
      throw new Error("UserId requis");
    }

    return TagRepository.create({
      userId,
      tagName,
    });
  }

  static async findByUserId(userId) {
    if (!userId) {
      throw new Error("UserId requis");
    }
    return await TagRepository.findByUserId(userId);
  }

  static async findById(tagId) {
    if (!tagId) {
      throw new Error("TagId requis");
    }
    return await TagRepository.findById(tagId);
  }

  static async findByIdForUser(tagId, userId) {
    if (!tagId) {
      throw new Error("TagId requis");
    }

    if (!userId) {
      throw new Error("UserId requis");
    }

    return await TagRepository.findByIdForUser(tagId, userId);
  }

  // renommer un tag
  static async update(tagId, userId, tagName) {
    const tag = await TagRepository.findByIdForUser(tagId, userId);

    if (!tag) {
      throw new Error("Tag introuvable.");
    }

    return TagRepository.update(tagId, userId, { tagName });
  }

  // Supprimer un tag

  static async delete(tagId, userId) {
    const tag = await TagRepository.findByIdForUser(tagId, userId);

    if (!tag) {
      throw new Error("Tag introuvable.");
    }

    return TagRepository.delete(tagId, userId);
  }
}

export default TagService;
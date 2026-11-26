"use strict";

import ListRepository from "../repositories/PgListRepository.js";
import { generateSlug } from "../utils/generateSlug.js";
import { AppError } from "../utils/AppError.js";

class ListService {
  static findAllByUser(userId) {
    return ListRepository.findAllByUser(userId);
  }

  static async create(userId, data) {
    const slug = generateSlug(data.title);
    if (!slug)
      throw AppError.badRequest("Le titre doit contenir au moins une lettre ou un chiffre.");
    return ListRepository.create(userId, { ...data, slug });
  }

  static async getOwned(userId, slug) {
    const list = await ListRepository.findBySlug(userId, slug);
    if (!list) throw AppError.notFound("Liste introuvable.");
    return list;
  }

  static async getDetail(userId, slug) {
    const list = await this.getOwned(userId, slug);
    const [items, candidates] = await Promise.all([
      ListRepository.findItems(list.id),
      ListRepository.candidateGames(userId, list.id),
    ]);
    return { list, items, candidates };
  }

  static async update(userId, slug, data) {
    const list = await this.getOwned(userId, slug);
    return ListRepository.update(list.id, userId, data);
  }

  static async delete(userId, slug) {
    const list = await this.getOwned(userId, slug);
    return ListRepository.delete(list.id, userId);
  }

  static async addItem(userId, slug, { gameId, note }) {
    const list = await this.getOwned(userId, slug);
    const added = await ListRepository.addItem(list.id, userId, gameId, note);
    if (!added)
      throw AppError.badRequest("Ce jeu est déjà dans la liste ou absent de ta bibliothèque.");
  }

  static async removeItem(userId, slug, gameId) {
    const list = await this.getOwned(userId, slug);
    await ListRepository.removeItem(list.id, userId, gameId);
  }

  static async getPublic(pseudo, slug) {
    const list = await ListRepository.findPublic(pseudo, slug);
    if (!list) throw AppError.notFound("Liste introuvable.");
    return { list, items: await ListRepository.findItems(list.id) };
  }
}

export default ListService;

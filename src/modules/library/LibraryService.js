"use strict";

import UserItemRepository from "./UserItemRepository.js";
import CatalogService from "../catalog/CatalogService.js";
import ItemRepository from "../catalog/ItemRepository.js";
import { AppError } from "../../utils/AppError.js";
import { STATUSES } from "../../utils/itemTypes.js";

/**
 * Bibliothèque de l'utilisateur : ce qu'il suit, tous types confondus.
 */

// Valeurs reçues des formulaires de la fiche, validées une à une
export const parseEntryFields = (body = {}) => {
  const fields = {};
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) throw new AppError("Statut inconnu.", 400);
    fields.status = body.status;
  }
  if ("rating" in body) {
    const raw = String(body.rating ?? "").trim();
    const rating = raw === "" ? null : Number(raw);
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) {
      throw new AppError("La note doit être comprise entre 1 et 10.", 400);
    }
    fields.rating = rating;
  }
  if ("review" in body) {
    const review = String(body.review ?? "").trim();
    if (review.length > 5000) throw new AppError("L'avis ne peut pas dépasser 5000 caractères.", 400);
    fields.review = review || null;
  }
  return fields;
};

export const parseTagName = (value) => {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 30) {
    throw new AppError("Un tag fait entre 2 et 30 caractères.", 400);
  }
  return name;
};

class LibraryService {
  static getEntries(userId, filters) {
    return UserItemRepository.findAllByUser(userId, filters);
  }

  static async getSection(userId, type, status) {
    const [entries, counts] = await Promise.all([
      UserItemRepository.findAllByUser(userId, { type, status }),
      UserItemRepository.countByStatus(userId, type),
    ]);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { entries, counts: Object.fromEntries(STATUSES.map((s) => [s, counts[s] ?? 0])), total };
  }

  static async getDashboard(userId) {
    const [entries, counts] = await Promise.all([
      UserItemRepository.findAllByUser(userId),
      UserItemRepository.countByStatus(userId),
    ]);
    const byStatus = (status) => entries.filter((entry) => entry.status === status);

    return {
      stats: {
        inProgress: counts.in_progress ?? 0,
        planned: counts.planned ?? 0,
        completed: counts.completed ?? 0,
      },
      current: byStatus("in_progress").slice(0, 10),
      recentlyCompleted: byStatus("completed").slice(0, 5),
    };
  }

  static async getEntry(entryId, userId) {
    const entry = await UserItemRepository.findByIdForUser(entryId, userId);
    if (!entry) throw new AppError("Entrée introuvable.", 404);
    return entry;
  }

  // Aperçu d'une œuvre avant ajout ; renvoie l'entrée si elle est déjà suivie
  static async preview(userId, source, externalId) {
    const item = await CatalogService.resolveItem(source, externalId);
    const entry = await UserItemRepository.findByItemForUser(item.id, userId);
    return { item, entry };
  }

  static async add(userId, source, externalId, { status = "planned" } = {}) {
    if (!STATUSES.includes(status)) throw new AppError("Statut inconnu.", 400);
    const item = await CatalogService.resolveItem(source, externalId);
    return UserItemRepository.create(userId, item.id, { status });
  }

  static async update(entryId, userId, body) {
    await this.getEntry(entryId, userId);
    return UserItemRepository.update(entryId, userId, parseEntryFields(body));
  }

  static async toggleFavorite(entryId, userId) {
    const entry = await this.getEntry(entryId, userId);
    return UserItemRepository.update(entryId, userId, { isFavorite: !entry.isFavorite });
  }

  static async addTag(entryId, userId, tagName) {
    await this.getEntry(entryId, userId);
    await UserItemRepository.addTag(entryId, userId, parseTagName(tagName));
    return this.getEntry(entryId, userId);
  }

  static async removeTag(entryId, userId, tagId) {
    await UserItemRepository.removeTag(entryId, userId, tagId);
    return this.getEntry(entryId, userId);
  }

  static async remove(entryId, userId) {
    const deleted = await UserItemRepository.delete(entryId, userId);
    if (!deleted) throw new AppError("Entrée introuvable.", 404);
  }

  static async getCharacters(entryId, userId) {
    const entry = await this.getEntry(entryId, userId);
    const item = await ItemRepository.findById(entry.itemId);
    return { entry, ...(await CatalogService.getEntities(item, userId)) };
  }

  static async toggleFavoriteCharacter(entryId, userId, entityId) {
    const entry = await this.getEntry(entryId, userId);
    const entity = await ItemRepository.findEntityForItem(entityId, entry.itemId);
    if (!entity) throw new AppError("Personnage introuvable.", 404);
    const isFavorite = await ItemRepository.toggleFavoriteEntity(userId, entityId, entry.itemId);
    return { entry, entity: { ...entity, isFavorite } };
  }
}

export default LibraryService;

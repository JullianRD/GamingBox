"use strict";

import ListRepository from "./ListRepository.js";
import UserItemRepository from "../library/UserItemRepository.js";
import ItemRepository from "../catalog/ItemRepository.js";
import { AppError } from "../../utils/AppError.js";
import { generateSlug } from "../../utils/generateSlug.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";
import SocialService from "../social/SocialService.js";

export const parseListInput = (body = {}) => {
  const title = String(body.title ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 100) {
    throw new AppError("Le titre de la liste fait entre 2 et 100 caractères.", 400);
  }
  const description = String(body.description ?? "").trim();
  if (description.length > 500)
    throw new AppError("La description ne peut pas dépasser 500 caractères.", 400);
  const type = body.type ? String(body.type) : null;
  if (type && !ITEM_TYPES[type]) throw new AppError("Catégorie inconnue.", 400);
  return { title, description: description || null, type };
};

class ListService {
  static getLists(userId) {
    return ListRepository.findAllByUser(userId);
  }

  // Listes de l'utilisateur, avec l'indication « contient déjà cette œuvre »
  static getListsForItem(userId, itemId) {
    return ListRepository.findAllByUser(userId, { itemId });
  }

  static async getFavorites(userId) {
    const [entries, characters] = await Promise.all([
      UserItemRepository.findAllByUser(userId, { favorite: true }),
      ItemRepository.findFavoriteEntities(userId),
    ]);
    return { entries, characters };
  }

  static async getList(userId, slug) {
    const list = await ListRepository.findBySlug(userId, slug);
    if (!list) throw new AppError("Liste introuvable.", 404);
    return { list, items: await ListRepository.findItems(list, userId) };
  }

  static async create(userId, body) {
    const input = parseListInput(body);
    const base = generateSlug(input.title) || "liste";
    let slug = base;
    for (let n = 2; await ListRepository.slugExists(userId, slug); n++) slug = `${base}-${n}`;
    return ListRepository.create(userId, { ...input, slug });
  }

  static async remove(userId, slug) {
    const list = await ListRepository.findBySlug(userId, slug);
    if (!list) throw new AppError("Liste introuvable.", 404);
    await ListRepository.delete(userId, list.id);
    return list;
  }

  // Ajoute ou retire l'œuvre d'une entrée dans une liste (bouton bascule de la fiche)
  static async toggleEntryInList(userId, entryId, listId) {
    const entry = await UserItemRepository.findByIdForUser(entryId, userId);
    const list = await ListRepository.findById(userId, listId);
    if (!entry || !list) throw new AppError("Liste ou entrée introuvable.", 404);

    const lists = await ListRepository.findAllByUser(userId, { itemId: entry.itemId });
    const contains = lists.find((l) => l.id === list.id)?.contains;
    if (contains) {
      await ListRepository.removeItem(list.id, entry.itemId);
    } else {
      await ListRepository.addItem(list.id, entry.itemId);
      if (list.isPublic) {
        await SocialService.record({
          userId,
          kind: "listed",
          userItemId: entry.id,
          itemId: entry.itemId,
          listId: list.id,
        });
      }
    }

    return { entry, lists: await ListRepository.findAllByUser(userId, { itemId: entry.itemId }) };
  }

  static async setPublic(userId, slug, isPublic) {
    const list = await ListRepository.findBySlug(userId, slug);
    if (!list) throw new AppError("Liste introuvable.", 404);
    await ListRepository.setPublic(list.id, Boolean(isPublic));
    return { ...list, isPublic: Boolean(isPublic) };
  }

  static async removeItem(userId, slug, itemId) {
    const list = await ListRepository.findBySlug(userId, slug);
    if (!list) throw new AppError("Liste introuvable.", 404);
    await ListRepository.removeItem(list.id, itemId);
    return list;
  }
}

export default ListService;

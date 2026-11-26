"use strict";

import SocialRepository from "./SocialRepository.js";
import UserItemRepository from "../library/UserItemRepository.js";
import ListRepository from "../lists/ListRepository.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../config/logger.js";

export const parseComment = (value) => {
  const body = String(value ?? "").trim();
  if (!body) throw new AppError("Le commentaire est vide.", 400);
  if (body.length > 2000) throw new AppError("Un commentaire fait au plus 2000 caractères.", 400);
  return body;
};

// Un profil privé n'est visible que par son propriétaire
export const canView = (owner, viewerId) => Boolean(owner) && (owner.isPublic || owner.id === viewerId);

class SocialService {
  // L'activité ne doit jamais faire échouer l'action principale
  static async record(activity) {
    try {
      await SocialRepository.recordActivity(activity);
    } catch (error) {
      logger.warn({ err: error, kind: activity.kind }, "Activité non enregistrée");
    }
  }

  static async getProfile(pseudo, viewerId) {
    const user = await SocialRepository.findUserByPseudo(pseudo);
    if (!canView(user, viewerId)) throw new AppError("Profil introuvable.", 404);

    const isSelf = user.id === viewerId;
    const [stats, relation, favorites, lists, recent, activity] = await Promise.all([
      SocialRepository.getProfileStats(user.id),
      isSelf ? null : SocialRepository.getRelation(viewerId, user.id),
      UserItemRepository.findAllByUser(user.id, { favorite: true }),
      ListRepository.findAllByUser(user.id),
      UserItemRepository.findAllByUser(user.id, { status: "completed" }),
      SocialRepository.getUserActivity(user.id),
    ]);

    return {
      profile: user,
      isSelf,
      stats,
      relation,
      favorites: favorites.slice(0, 10),
      lists: isSelf ? lists : lists.filter((list) => list.isPublic),
      recent: recent.slice(0, 6),
      activity,
    };
  }

  static async toggleFollow(viewerId, pseudo) {
    const user = await SocialRepository.findUserByPseudo(pseudo);
    if (!user || !user.isPublic || user.id === viewerId) throw new AppError("Profil introuvable.", 404);

    const { following } = await SocialRepository.getRelation(viewerId, user.id);
    if (following) {
      await SocialRepository.unfollow(viewerId, user.id);
    } else if (await SocialRepository.follow(viewerId, user.id)) {
      await this.record({ userId: viewerId, kind: "followed", targetUserId: user.id });
    }
    return { profile: user, relation: await SocialRepository.getRelation(viewerId, user.id) };
  }

  static getConnections(userId) {
    return SocialRepository.getConnections(userId);
  }

  static getFriends(userId) {
    return SocialRepository.getFriends(userId);
  }

  static getFeed(userId, before) {
    const date = before ? new Date(before) : null;
    return SocialRepository.getFeed(userId, { before: date && !Number.isNaN(date.getTime()) ? date : null });
  }

  static searchUsers(query, viewerId) {
    return SocialRepository.searchUsers(query, viewerId);
  }

  static async setPublic(userId, isPublic) {
    await SocialRepository.setPublic(userId, Boolean(isPublic));
  }

  // Entrée d'un autre utilisateur, en lecture seule
  static async getPublicEntry(entryId, viewerId) {
    const owner = await SocialRepository.findEntryOwner(entryId);
    if (!canView(owner, viewerId)) throw new AppError("Entrée introuvable.", 404);
    const entry = await UserItemRepository.findByIdForUser(entryId, owner.id);
    const mine = await UserItemRepository.findByItemForUser(entry.itemId, viewerId);
    return { owner, entry, mine };
  }

  static getComments(entryId) {
    return SocialRepository.getComments(entryId);
  }

  static async addComment(entryId, viewerId, body) {
    const owner = await SocialRepository.findEntryOwner(entryId);
    if (!canView(owner, viewerId)) throw new AppError("Entrée introuvable.", 404);
    const text = parseComment(body);
    await SocialRepository.addComment(entryId, viewerId, text);
    const entry = await UserItemRepository.findByIdForUser(entryId, owner.id);
    await this.record({
      userId: viewerId,
      kind: "commented",
      userItemId: entryId,
      itemId: entry.itemId,
      targetUserId: owner.id === viewerId ? null : owner.id,
    });
    return { ownerId: owner.id, comments: await SocialRepository.getComments(entryId) };
  }

  static async deleteComment(commentId, viewerId) {
    const entryId = await SocialRepository.deleteComment(commentId, viewerId);
    if (!entryId) throw new AppError("Commentaire introuvable.", 404);
    const owner = await SocialRepository.findEntryOwner(entryId);
    return { entryId, ownerId: owner.id, comments: await SocialRepository.getComments(entryId) };
  }

  static async getPublicList(pseudo, slug, viewerId) {
    const owner = await SocialRepository.findUserByPseudo(pseudo);
    if (!canView(owner, viewerId)) throw new AppError("Liste introuvable.", 404);
    const list = await ListRepository.findBySlug(owner.id, slug);
    if (!list || (!list.isPublic && owner.id !== viewerId)) throw new AppError("Liste introuvable.", 404);
    return { owner, list, items: await ListRepository.findItems(list, viewerId) };
  }
}

export default SocialService;

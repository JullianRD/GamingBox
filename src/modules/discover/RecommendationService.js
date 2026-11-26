"use strict";

import db from "../../config/database.js";
import SocialService from "../social/SocialService.js";
import UserItemRepository from "../library/UserItemRepository.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Recommandations entre amis : depuis une de ses fiches, on propose l'œuvre
 * à un ou plusieurs amis (abonnements réciproques), avec un mot.
 */

const MAX_MESSAGE = 500;

class RecommendationService {
  static async send(senderId, entryId, recipientIds, message) {
    const entry = await UserItemRepository.findByIdForUser(entryId, senderId);
    if (!entry) throw new AppError("Entrée introuvable.", 404);
    const wanted = [...new Set([recipientIds].flat().filter(Boolean).map(String))];
    if (!wanted.length) throw new AppError("Choisis au moins un ami.", 400);
    const text = String(message ?? "").trim().slice(0, MAX_MESSAGE) || null;

    const friends = await SocialService.getFriends(senderId);
    const recipients = friends.filter((f) => wanted.includes(f.id));
    if (recipients.length !== wanted.length) throw new AppError("Tu ne peux recommander qu'à tes amis.", 403);

    for (const friend of recipients) {
      // Une nouvelle recommandation de la même œuvre remonte en haut et redevient non lue
      await db.query(
        `
          INSERT INTO recommendations (sender_id, recipient_id, item_id, message) VALUES ($1, $2, $3, $4)
          ON CONFLICT (sender_id, recipient_id, item_id)
          DO UPDATE SET message = EXCLUDED.message, created_at = NOW(), seen_at = NULL
        `,
        [senderId, friend.id, entry.itemId, text],
      );
      await SocialService.record({ userId: senderId, kind: "recommended", itemId: entry.itemId, userItemId: entry.id, targetUserId: friend.id });
    }
    return recipients;
  }

  static async unseenCount(userId) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM recommendations WHERE recipient_id = $1 AND seen_at IS NULL`,
      [userId],
    );
    return rows[0].n;
  }

  static async inbox(userId) {
    const { rows } = await db.query(
      `
        SELECT r.id_recommendation, r.message, r.created_at, r.seen_at,
               u.pseudo, u.avatar, u.id_user,
               i.item_type, i.source, i.external_id, i.title, i.cover_url, i.release_date,
               mine.id_user_item AS my_entry_id
        FROM recommendations r
        JOIN users u ON u.id_user = r.sender_id
        JOIN items i ON i.id_item = r.item_id
        LEFT JOIN user_items mine ON mine.item_id = r.item_id AND mine.user_id = r.recipient_id
        WHERE r.recipient_id = $1
        ORDER BY r.created_at DESC
        LIMIT 100
      `,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id_recommendation,
      message: r.message,
      createdAt: r.created_at,
      unseen: !r.seen_at,
      sender: { id: r.id_user, pseudo: r.pseudo, avatar: r.avatar },
      item: {
        type: r.item_type,
        title: r.title,
        coverUrl: r.cover_url,
        releaseDate: r.release_date,
        href: r.my_entry_id ? `/entrees/${r.my_entry_id}` : `/ajouter/${r.source}/${encodeURIComponent(r.external_id)}`,
        inLibrary: Boolean(r.my_entry_id),
      },
    }));
  }

  static async markAllSeen(userId) {
    await db.query(`UPDATE recommendations SET seen_at = NOW() WHERE recipient_id = $1 AND seen_at IS NULL`, [userId]);
  }

  static async remove(userId, recommendationId) {
    const { rowCount } = await db.query(
      `DELETE FROM recommendations WHERE id_recommendation = $1 AND recipient_id = $2`,
      [recommendationId, userId],
    );
    return rowCount > 0;
  }

  // Amis qui ont déjà reçu cette œuvre de ma part (pour la fiche)
  static async sentFor(senderId, itemId) {
    const { rows } = await db.query(`SELECT recipient_id FROM recommendations WHERE sender_id = $1 AND item_id = $2`, [senderId, itemId]);
    return new Set(rows.map((r) => r.recipient_id));
  }
}

export default RecommendationService;

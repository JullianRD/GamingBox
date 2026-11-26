"use strict";

import db from "../config/database.js";
import UserRepository from "../repositories/PgUserRepository.js";

/**
 * Export RGPD : toutes les données d'un utilisateur, au format JSON.
 */
class UserExportService {
  static async export(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) return null;

    const query = async (sql) => (await db.query(sql, [userId])).rows;
    const [entries, tags, lists, favoriteCharacters, follows, comments, recommendations] = await Promise.all([
      query(`
        SELECT i.item_type, i.source, i.external_id, i.title, ui.status, ui.rating, ui.review,
               ui.is_favorite, ui.started_at, ui.finished_at, ui.created_at, ui.updated_at,
               COALESCE(array_agg(t.tag_name::text) FILTER (WHERE t.id_tag IS NOT NULL), '{}') AS tags
        FROM user_items ui
        JOIN items i ON i.id_item = ui.item_id
        LEFT JOIN user_item_tags uit ON uit.user_item_id = ui.id_user_item
        LEFT JOIN tags t ON t.id_tag = uit.tag_id
        WHERE ui.user_id = $1
        GROUP BY ui.id_user_item, i.id_item
        ORDER BY ui.created_at`),
      query(`SELECT tag_name, created_at FROM tags WHERE user_id = $1 ORDER BY tag_name`),
      query(`
        SELECT l.title, l.description, l.item_type, l.is_public, l.created_at,
               COALESCE(json_agg(json_build_object('title', i.title, 'position', li.position) ORDER BY li.position)
                 FILTER (WHERE i.id_item IS NOT NULL), '[]') AS items
        FROM lists l
        LEFT JOIN list_items li ON li.list_id = l.id_list
        LEFT JOIN items i ON i.id_item = li.item_id
        WHERE l.user_id = $1
        GROUP BY l.id_list`),
      query(`
        SELECT e.name, e.entity_kind, f.created_at FROM user_favorite_entities f
        JOIN entities e ON e.id_entity = f.entity_id WHERE f.user_id = $1`),
      query(`
        SELECT u.pseudo, f.created_at FROM follows f
        JOIN users u ON u.id_user = f.followed_id WHERE f.follower_id = $1`),
      query(`SELECT body, created_at FROM entry_comments WHERE author_id = $1 ORDER BY created_at`),
      query(`
        SELECT u.pseudo AS recipient, i.title, r.message, r.created_at FROM recommendations r
        JOIN users u ON u.id_user = r.recipient_id JOIN items i ON i.id_item = r.item_id
        WHERE r.sender_id = $1`),
    ]);

    return {
      user: user.toJSON(),
      entries,
      tags,
      lists,
      favoriteCharacters,
      follows,
      comments,
      recommendations,
      exportDate: new Date().toISOString(),
    };
  }
}

export default UserExportService;

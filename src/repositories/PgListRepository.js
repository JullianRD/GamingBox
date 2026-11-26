"use strict";

import db from "../config/database.js";
import { AppError } from "../utils/AppError.js";

const LIST_COLUMNS =
  "l.id_list, l.user_id, l.title, l.slug, l.description, l.is_public, l.created_at, l.updated_at";

const mapList = (row) => ({
  id: row.id_list,
  userId: row.user_id,
  title: row.title,
  slug: row.slug,
  description: row.description,
  isPublic: row.is_public,
  itemCount: row.item_count !== undefined ? Number(row.item_count) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapItem = (row) => ({
  gameId: row.game_id,
  position: row.position,
  note: row.note,
  gameTitle: row.game_title,
  gameGenre: row.game_genre,
  thumbnailUrl: row.thumbnail_url,
});

class ListRepository {
  static async findAllByUser(userId) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${LIST_COLUMNS}, COUNT(i.game_id) AS item_count
        FROM game_lists l LEFT JOIN game_list_items i ON i.list_id = l.id_list
        WHERE l.user_id = $1
        GROUP BY l.id_list ORDER BY l.created_at DESC`,
      [userId],
    );
    return rows.map(mapList);
  }

  static async findBySlug(userId, slug) {
    const { rows } = await db.query(
      `SELECT ${LIST_COLUMNS} FROM game_lists l WHERE l.user_id = $1 AND l.slug = $2`,
      [userId, slug],
    );
    return rows[0] ? mapList(rows[0]) : null;
  }

  static async findItems(listId) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT i.game_id, i.position, i.note, g.game_title, g.game_genre, g.thumbnail_url
        FROM game_list_items i JOIN games g ON g.id_game = i.game_id
        WHERE i.list_id = $1 ORDER BY i.position ASC, i.added_at ASC`,
      [listId],
    );
    return rows.map(mapItem);
  }

  // Liste publique d'un profil public (lecture anonyme)
  static async findPublic(pseudo, slug) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${LIST_COLUMNS}, u.pseudo AS owner_pseudo
        FROM game_lists l JOIN users u ON u.id_user = l.user_id
        WHERE u.pseudo = $1 AND l.slug = $2 AND l.is_public AND u.profile_public`,
      [pseudo, slug],
    );
    return rows[0] ? { ...mapList(rows[0]), ownerPseudo: rows[0].owner_pseudo } : null;
  }

  static async findPublicByUser(userId) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${LIST_COLUMNS}, COUNT(i.game_id) AS item_count
        FROM game_lists l LEFT JOIN game_list_items i ON i.list_id = l.id_list
        WHERE l.user_id = $1 AND l.is_public
        GROUP BY l.id_list ORDER BY l.created_at DESC`,
      [userId],
    );
    return rows.map(mapList);
  }

  static async create(userId, { title, slug, description, isPublic }) {
    try {
      const { rows } = await db.query(
        /*sql*/ `
          INSERT INTO game_lists (user_id, title, slug, description, is_public)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id_list AS id_list, user_id, title, slug, description, is_public, created_at, updated_at`,
        [userId, title, slug, description || null, Boolean(isPublic)],
      );
      return mapList(rows[0]);
    } catch (error) {
      if (error.code === "23505") throw AppError.conflict("Tu as déjà une liste avec ce titre.");
      throw error;
    }
  }

  static async update(id, userId, { title, description, isPublic }) {
    const { rows } = await db.query(
      /*sql*/ `
        UPDATE game_lists SET title = $1, description = $2, is_public = $3
        WHERE id_list = $4 AND user_id = $5
        RETURNING id_list, user_id, title, slug, description, is_public, created_at, updated_at`,
      [title, description || null, Boolean(isPublic), id, userId],
    );
    return rows[0] ? mapList(rows[0]) : null;
  }

  static async delete(id, userId) {
    const result = await db.query("DELETE FROM game_lists WHERE id_list = $1 AND user_id = $2", [
      id,
      userId,
    ]);
    return result.rowCount > 0;
  }

  // Jeux que l'utilisateur peut ajouter : ceux qu'il a déjà dans sa bibliothèque
  static async candidateGames(userId, listId) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT DISTINCT g.id_game AS game_id, g.game_title, g.game_genre, g.thumbnail_url, 0 AS position, NULL AS note
        FROM reviews r JOIN games g ON g.id_game = r.game_id
        WHERE r.user_id = $1
          AND NOT EXISTS (SELECT 1 FROM game_list_items i WHERE i.list_id = $2 AND i.game_id = g.id_game)
        ORDER BY g.game_title`,
      [userId, listId],
    );
    return rows.map(mapItem);
  }

  /** Ajoute un jeu à une liste de l'utilisateur, seulement s'il possède une review sur ce jeu. */
  static async addItem(listId, userId, gameId, note = null) {
    const { rowCount } = await db.query(
      /*sql*/ `
        INSERT INTO game_list_items (list_id, game_id, position, note)
        SELECT l.id_list, $3,
               COALESCE((SELECT MAX(position) + 1 FROM game_list_items WHERE list_id = l.id_list), 0), $4
        FROM game_lists l
        WHERE l.id_list = $1 AND l.user_id = $2
          AND EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = $2 AND r.game_id = $3)
        ON CONFLICT DO NOTHING`,
      [listId, userId, gameId, note],
    );
    return rowCount > 0;
  }

  static async removeItem(listId, userId, gameId) {
    const result = await db.query(
      /*sql*/ `
        DELETE FROM game_list_items i USING game_lists l
        WHERE i.list_id = l.id_list AND l.user_id = $2 AND i.list_id = $1 AND i.game_id = $3`,
      [listId, userId, gameId],
    );
    return result.rowCount > 0;
  }
}

export default ListRepository;

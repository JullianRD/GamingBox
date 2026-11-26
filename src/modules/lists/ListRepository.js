"use strict";

import db from "../../config/database.js";

const toList = (row) =>
  row
    ? {
        id: row.id_list,
        title: row.title,
        slug: row.slug,
        description: row.description,
        type: row.item_type,
        isPublic: row.is_public,
        href: `/listes/${row.slug}`,
        count: row.item_count !== undefined ? Number(row.item_count) : undefined,
        covers: row.covers ?? [],
        contains: row.contains ?? undefined,
        updatedAt: row.updated_at || row.created_at,
      }
    : null;

class ListRepository {
  // Listes de l'utilisateur avec leur taille et quatre jaquettes d'aperçu
  static async findAllByUser(userId, { itemId = null } = {}) {
    const { rows } = await db.query(
      `
        SELECT l.*,
          (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id_list) AS item_count,
          COALESCE((
            SELECT json_agg(json_build_object('title', x.title, 'coverUrl', x.cover_url, 'type', x.item_type))
            FROM (
              SELECT i.title, i.cover_url, i.item_type FROM list_items li
              JOIN items i ON i.id_item = li.item_id
              WHERE li.list_id = l.id_list ORDER BY li.position LIMIT 4
            ) x
          ), '[]') AS covers,
          ($2::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM list_items li WHERE li.list_id = l.id_list AND li.item_id = $2
          )) AS contains
        FROM lists l
        WHERE l.user_id = $1
        ORDER BY COALESCE(l.updated_at, l.created_at) DESC
      `,
      [userId, itemId],
    );
    return rows.map(toList);
  }

  static async findBySlug(userId, slug) {
    const { rows } = await db.query(`SELECT * FROM lists WHERE user_id = $1 AND slug = $2`, [userId, slug]);
    return toList(rows[0]);
  }

  static async findById(userId, listId) {
    const { rows } = await db.query(`SELECT * FROM lists WHERE user_id = $1 AND id_list = $2`, [
      userId,
      listId,
    ]);
    return toList(rows[0]);
  }

  static async slugExists(userId, slug) {
    const { rowCount } = await db.query(`SELECT 1 FROM lists WHERE user_id = $1 AND slug = $2`, [
      userId,
      slug,
    ]);
    return rowCount > 0;
  }

  static async create(userId, { title, slug, description, type }) {
    const { rows } = await db.query(
      `
        INSERT INTO lists (user_id, title, slug, description, item_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [userId, title, slug, description || null, type || null],
    );
    return toList(rows[0]);
  }

  static async delete(userId, listId) {
    await db.query(`DELETE FROM lists WHERE user_id = $1 AND id_list = $2`, [userId, listId]);
  }

  // Œuvres de la liste, avec l'entrée de l'utilisateur si elle existe
  static async findItems(list, userId) {
    const { rows } = await db.query(
      `
        SELECT i.*, li.position, li.note, ui.id_user_item, ui.status, ui.rating
        FROM list_items li
        JOIN items i ON i.id_item = li.item_id
        LEFT JOIN user_items ui ON ui.item_id = i.id_item AND ui.user_id = $2
        WHERE li.list_id = $1
        ORDER BY li.position, li.created_at
      `,
      [list.id, userId],
    );
    return rows.map((row) => ({
      itemId: row.id_item,
      type: row.item_type,
      title: row.title,
      coverUrl: row.cover_url,
      href: row.id_user_item ? `/entrees/${row.id_user_item}` : `/ajouter/${row.source}/${row.external_id}`,
      position: row.position,
      note: row.note,
      status: row.status,
      rating: row.rating,
    }));
  }

  static async addItem(listId, itemId) {
    await db.query(
      `
        INSERT INTO list_items (list_id, item_id, position)
        SELECT $1, $2, COALESCE(MAX(position) + 1, 0) FROM list_items WHERE list_id = $1
        ON CONFLICT (list_id, item_id) DO NOTHING
      `,
      [listId, itemId],
    );
    await db.query(`UPDATE lists SET updated_at = now() WHERE id_list = $1`, [listId]);
  }

  static async removeItem(listId, itemId) {
    await db.query(`DELETE FROM list_items WHERE list_id = $1 AND item_id = $2`, [listId, itemId]);
    await db.query(`UPDATE lists SET updated_at = now() WHERE id_list = $1`, [listId]);
  }
}

export default ListRepository;

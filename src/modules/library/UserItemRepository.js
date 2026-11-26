"use strict";

import db from "../../config/database.js";

const SELECT_ENTRY = `
  SELECT
    ui.*,
    i.item_type, i.source, i.external_id, i.title, i.release_date, i.cover_url, i.genres,
    i.metadata AS item_metadata,
    COALESCE(
      (SELECT json_agg(json_build_object('id', t.id_tag, 'name', t.tag_name) ORDER BY t.tag_name)
       FROM user_item_tags uit JOIN tags t ON t.id_tag = uit.tag_id
       WHERE uit.user_item_id = ui.id_user_item),
      '[]'
    ) AS tags
  FROM user_items ui
  JOIN items i ON i.id_item = ui.item_id
`;

// Ligne SQL vers une entrée de liste, format commun à toutes les vues
export const toEntry = (row) =>
  row
    ? {
        id: row.id_user_item,
        itemId: row.item_id,
        type: row.item_type,
        source: row.source,
        externalId: row.external_id,
        title: row.title,
        href: `/entrees/${row.id_user_item}`,
        coverUrl: row.cover_url,
        releaseDate: row.release_date,
        genres: row.genres ?? [],
        itemMetadata: row.item_metadata ?? {},
        status: row.status,
        rating: row.rating,
        review: row.review,
        isFavorite: row.is_favorite,
        tags: row.tags ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
      }
    : null;

// Champs modifiables depuis la fiche
const EDITABLE = {
  status: "status",
  rating: "rating",
  review: "review",
  isFavorite: "is_favorite",
};

class UserItemRepository {
  static async findAllByUser(userId, { type = null, status = null, favorite = null } = {}) {
    const { rows } = await db.query(
      `${SELECT_ENTRY}
        WHERE ui.user_id = $1
          AND ($2::item_type_enum IS NULL OR i.item_type = $2)
          AND ($3::entry_status_enum IS NULL OR ui.status = $3)
          AND ($4::boolean IS NULL OR ui.is_favorite = $4)
        ORDER BY COALESCE(ui.updated_at, ui.created_at) DESC`,
      [userId, type, status, favorite],
    );
    return rows.map(toEntry);
  }

  // Nombre d'entrées et dernières jaquettes par catégorie
  static async overviewByType(userId) {
    const { rows } = await db.query(
      `
        SELECT i.item_type, COUNT(*)::int AS count,
          (array_agg(i.cover_url ORDER BY COALESCE(ui.updated_at, ui.created_at) DESC) FILTER (WHERE i.cover_url IS NOT NULL))[1:3] AS covers
        FROM user_items ui JOIN items i ON i.id_item = ui.item_id
        WHERE ui.user_id = $1
        GROUP BY i.item_type
      `,
      [userId],
    );
    return Object.fromEntries(
      rows.map((row) => [row.item_type, { count: row.count, covers: row.covers ?? [] }]),
    );
  }

  // Nombre d'entrées par statut pour un type
  static async countByStatus(userId, type = null) {
    const { rows } = await db.query(
      `
        SELECT ui.status, COUNT(*)::int AS count
        FROM user_items ui JOIN items i ON i.id_item = ui.item_id
        WHERE ui.user_id = $1 AND ($2::item_type_enum IS NULL OR i.item_type = $2)
        GROUP BY ui.status
      `,
      [userId, type],
    );
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  static async findByIdForUser(entryId, userId) {
    const { rows } = await db.query(`${SELECT_ENTRY} WHERE ui.id_user_item = $1 AND ui.user_id = $2`, [
      entryId,
      userId,
    ]);
    return toEntry(rows[0]);
  }

  static async findByItemForUser(itemId, userId) {
    const { rows } = await db.query(`${SELECT_ENTRY} WHERE ui.item_id = $1 AND ui.user_id = $2`, [
      itemId,
      userId,
    ]);
    return toEntry(rows[0]);
  }

  // Ajoute l'œuvre à la bibliothèque ; sans effet si elle y est déjà
  static async create(userId, itemId, { status = "planned" } = {}) {
    const { rows } = await db.query(
      `
        INSERT INTO user_items (user_id, item_id, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, item_id) DO NOTHING
        RETURNING id_user_item
      `,
      [userId, itemId, status],
    );
    if (rows[0]) return rows[0].id_user_item;
    return (await this.findByItemForUser(itemId, userId)).id;
  }

  static async update(entryId, userId, fields) {
    const entries = Object.entries(fields).filter(([key]) => key in EDITABLE);
    if (!entries.length) return this.findByIdForUser(entryId, userId);

    const sets = entries.map(([key], index) => `${EDITABLE[key]} = $${index + 3}`);
    // La date de fin se pose au passage en « terminé »
    if (fields.status === "completed") sets.push("finished_at = COALESCE(finished_at, CURRENT_DATE)");
    if (fields.status === "in_progress") sets.push("started_at = COALESCE(started_at, CURRENT_DATE)");

    await db.query(`UPDATE user_items SET ${sets.join(", ")} WHERE id_user_item = $1 AND user_id = $2`, [
      entryId,
      userId,
      ...entries.map(([, value]) => value),
    ]);
    return this.findByIdForUser(entryId, userId);
  }

  static async delete(entryId, userId) {
    const { rowCount } = await db.query(`DELETE FROM user_items WHERE id_user_item = $1 AND user_id = $2`, [
      entryId,
      userId,
    ]);
    return rowCount > 0;
  }

  // Crée le tag de l'utilisateur au besoin et le pose sur l'entrée
  static async addTag(entryId, userId, tagName) {
    const { rows } = await db.query(
      `
        INSERT INTO tags (tag_name, user_id) VALUES ($1, $2)
        ON CONFLICT (user_id, tag_name) DO UPDATE SET tag_name = tags.tag_name
        RETURNING id_tag
      `,
      [tagName, userId],
    );
    await db.query(
      `
        INSERT INTO user_item_tags (user_item_id, tag_id)
        SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM user_items WHERE id_user_item = $1 AND user_id = $3)
        ON CONFLICT DO NOTHING
      `,
      [entryId, rows[0].id_tag, userId],
    );
  }

  // Tags de l'utilisateur avec le nombre d'entrées
  static async findTags(userId) {
    const { rows } = await db.query(
      `
        SELECT t.id_tag, t.tag_name, COUNT(uit.user_item_id)::int AS count
        FROM tags t LEFT JOIN user_item_tags uit ON uit.tag_id = t.id_tag
        WHERE t.user_id = $1
        GROUP BY t.id_tag
        ORDER BY t.tag_name
      `,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id_tag,
      name: row.tag_name,
      count: row.count,
      href: `/tags/${row.id_tag}`,
    }));
  }

  static async findByTag(userId, tagId) {
    const { rows } = await db.query(
      `${SELECT_ENTRY}
        WHERE ui.user_id = $1
          AND EXISTS (SELECT 1 FROM user_item_tags x WHERE x.user_item_id = ui.id_user_item AND x.tag_id = $2)
        ORDER BY COALESCE(ui.updated_at, ui.created_at) DESC`,
      [userId, tagId],
    );
    return rows.map(toEntry);
  }

  static async deleteTag(userId, tagId) {
    const { rowCount } = await db.query(`DELETE FROM tags WHERE id_tag = $1 AND user_id = $2`, [
      tagId,
      userId,
    ]);
    return rowCount > 0;
  }

  static async removeTag(entryId, userId, tagId) {
    await db.query(
      `
        DELETE FROM user_item_tags uit
        USING user_items ui
        WHERE uit.user_item_id = ui.id_user_item
          AND uit.user_item_id = $1 AND ui.user_id = $2 AND uit.tag_id = $3
      `,
      [entryId, userId, tagId],
    );
  }
}

export default UserItemRepository;

"use strict";

import db from "../config/database.js";
import Tag from "../entities/Tags.js";

// TagRepository : création, mise à jour et suppression des tag dans la base de données

class TagRepository {
  // Chercher les tag d'un utilisateur
  static async findByUserId(userId) {
    const { rows } = await db.query(
      /*SQL*/ `
        SELECT *
        FROM tags
        WHERE user_id = $1
        ORDER BY tag_name ASC
      `,
      [userId],
    );

    return rows.map((row) => new Tag(row));
  }

  // Chercher tous les tags (admin)
  static async findAllAdmin() {
    const { rows } = await db.query(
      /*SQL*/ `
        SELECT *
        FROM tags
        ORDER BY created_at DESC
      `,
    );

    return rows.map((row) => new Tag(row));
  }

  // Trouver un tag par son id pour un utilisateur donné
static async findByIdForUser(tagId, userId) {
  const query = /* SQL */ `
    SELECT
      id_tag,
      tag_name,
      user_id,
      created_at,
      updated_at
    FROM tags
    WHERE id_tag = $1
      AND user_id = $2
    LIMIT 1;
  `;

  const { rows } = await db.query(query, [tagId, userId]);
  return rows[0] ? new Tag(rows[0]) : null;
}

  /**
   * 📊 Tags avec nombre de reviews
   */
  static async findByUserIdWithCount(userId) {
    const { rows } = await db.query(
      /*SQL*/ `
        SELECT
          t.id_tag,
          t.tag_name,
          t.user_id,
          t.created_at,
          t.updated_at,
          COUNT(rt.id_review) AS review_count
        FROM tags t
        LEFT JOIN review_tags rt
          ON rt.id_tag = t.id_tag
        WHERE t.user_id = $1
        GROUP BY
          t.id_tag,
          t.tag_name,
          t.user_id,
          t.created_at,
          t.updated_at
        ORDER BY t.tag_name ASC
      `,
      [userId],
    );

    return rows.map((row) => new Tag(row));
  }

  /**
   * 🔍 Tag par ID
   */
  static async findById(id) {
    const { rows } = await db.query(
      /*SQL*/ `
        SELECT *
        FROM tags
        WHERE id_tag = $1
      `,
      [id],
    );

    return rows[0] ? new Tag(rows[0]) : null;
  }

  /**
   * ✅ Vérifie existence (technique → table)
   */
  static async existsByUserAndName(userId, tagName) {
    const { rows } = await db.query(
      /*SQL*/ `
        SELECT EXISTS (
          SELECT 1
          FROM tags
          WHERE user_id = $1
            AND LOWER(tag_name) = LOWER($2)
        ) AS exists
      `,
      [userId, tagName],
    );

    return rows[0].exists;
  }

  /**
   * ➕ Création
   */
  static async create({ tagName, userId }) {
    if (await this.existsByUserAndName(userId, tagName)) {
      throw new Error(`Le tag "${tagName}" existe déjà.`);
    }

    const { rows } = await db.query(
      /*SQL*/ `
        INSERT INTO tags (tag_name, user_id)
        VALUES ($1, $2)
        RETURNING *
      `,
      [tagName.trim(), userId],
    );

    return new Tag(rows[0]);
  }

  /**
   * ✏️ Mise à jour
   */
  static async update(id, { tagName }) {
    const tag = await this.findById(id);

    if (!tag) {
      return null;
    }

    if (
      tagName &&
      tagName.toLowerCase() !== tag.tagName.toLowerCase() &&
      (await this.existsByUserAndName(tag.userId, tagName))
    ) {
      throw new Error(`Le tag "${tagName}" existe déjà.`);
    }

    const { rows } = await db.query(
      /*SQL*/ `
        UPDATE tags
        SET
          tag_name = $1,
          updated_at = NOW()
        WHERE id_tag = $2
        RETURNING *
      `,
      [tagName.trim(), id],
    );

    return new Tag(rows[0]);
  }

  /**
   * 🗑️ Suppression
   */
  static async delete(id) {
    const result = await db.query(
      /*SQL*/ `
        DELETE FROM tags
        WHERE id_tag = $1
      `,
      [id],
    );

    return result.rowCount > 0;
  }
}

export default TagRepository;
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
        FROM v_user_tags
        WHERE user_id = $1
        ORDER BY tag_name ASC
      `,
      [userId],
    );
    return rows.map((row) => new Tag(row));
  }

  /**
   * 📊 Tags avec nombre de reviews
   */
  static async findByUserIdWithCount(userId) {
    const { rows } = await db.query(
      /*SQL*/ `
        SELECT *
        FROM v_user_tags_with_count
        WHERE user_id = $1
        ORDER BY tag_name ASC
      `,
      [userId],
    );

    return rows.map((row) => new Tag(row));
  }

  /**
   * 🔍 Tag par ID (édition)
   */
  static async findById(id) {
    const { rows } = await db.query(
      `
        SELECT *
        FROM v_user_tags
        WHERE id_tag = $1
      `,
      [id],
    );

    return rows[0] ? new Tag(rows[0]) : null;
  }

  /**
   * 🔒 Tag par ID + utilisateur
   */
  static async findByIdForUser(id, userId) {
    const { rows } = await db.query(
      `
        SELECT *
        FROM v_user_tags
        WHERE id_tag = $1 AND user_id = $2
      `,
      [id, userId],
    );

    return rows[0] ? new Tag(rows[0]) : null;
  }

  /**
   * ✅ Vérifie existence (technique → table)
   */
  static async existsByUserAndName(userId, tagName) {
    const { rows } = await db.query(
      `
        SELECT EXISTS (
          SELECT 1 FROM tags
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
      `
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
  static async update(id, userId, { tagName }) {
    const tag = await this.findByIdForUser(id, userId);
    if (!tag) return null;

    if (
      tagName &&
      tagName.toLowerCase() !== tag.tagName.toLowerCase() &&
      (await this.existsByUserAndName(tag.userId, tagName))
    ) {
      throw new Error(`Le tag "${tagName}" existe déjà.`);
    }

    const { rows } = await db.query(
      `
        UPDATE tags
        SET tag_name = $1, updated_at = NOW()
        WHERE id_tag = $2 AND user_id = $3
        RETURNING *
      `,
      [tagName.trim(), id, userId],
    );

    return rows[0] ? new Tag(rows[0]) : null;
  }

  /**
   * 🗑️ Suppression
   */
  static async delete(id, userId) {
    const result = await db.query(
      `
        DELETE FROM tags
        WHERE id_tag = $1 AND user_id = $2
      `,
      [id, userId],
    );

    return result.rowCount > 0;
  }
}

export default TagRepository;
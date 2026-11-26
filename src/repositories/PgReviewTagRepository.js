"use strict";

import db from "../config/database.js";
import Tag from "../entities/Tags.js";

/**
 * ReviewTagRepository : table pivot review_tags.
 * Toute écriture est filtrée sur le propriétaire des tags : on ne peut jamais
 * rattacher à sa review le tag d'un autre utilisateur.
 */
class ReviewTagRepository {
  static async findAllByReview(reviewId) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT t.id_tag, t.tag_name, t.user_id, t.created_at, t.updated_at
        FROM review_tags rt
        JOIN tags t ON t.id_tag = rt.id_tag
        WHERE rt.id_review = $1
        ORDER BY t.tag_name ASC`,
      [reviewId],
    );
    return rows.map((row) => new Tag(row));
  }

  /** Remplace l'ensemble des tags d'une review (idempotent, en une requête). */
  static async replaceForReview(reviewId, tagIds, userId, client = db) {
    const uniqueIds = [...new Set((tagIds || []).filter(Boolean))];

    await client.query("DELETE FROM review_tags WHERE id_review = $1", [reviewId]);

    if (!uniqueIds.length) return [];

    const { rows } = await client.query(
      /*sql*/ `
        INSERT INTO review_tags (id_review, id_tag)
        SELECT $1, t.id_tag FROM tags t
        WHERE t.user_id = $3 AND t.id_tag = ANY($2::uuid[])
        ON CONFLICT DO NOTHING
        RETURNING id_review, id_tag`,
      [reviewId, uniqueIds, userId],
    );
    return rows;
  }

  static async clearForReview(reviewId, client = db) {
    await client.query("DELETE FROM review_tags WHERE id_review = $1", [reviewId]);
  }
}

export default ReviewTagRepository;

"use strict";

import db from "../config/database.js";
import Tag from "../entities/Tags.js";

// ReviewTagRepository : gestion de la table pivot review_tags
// Permet d'associer, récupérer, remplacer et supprimer les tags liés à une review

class ReviewTagRepository {
  // Chercher tous les tags associés à une review
  static async findAllByReview(reviewId) {
    const { rows } = await db.query(
      /* SQL */ `
        SELECT
          t.id_tag,
          t.tag_name,
          t.user_id,
          t.created_at,
          t.updated_at
        FROM review_tags rt
        JOIN tags t
          ON t.id_tag = rt.id_tag
        WHERE rt.id_review = $1
        ORDER BY t.tag_name ASC
      `,
      [reviewId],
    );

    return rows.map((row) => new Tag(row));
  }

  // Ajouter un tag à une review
  static async add(reviewId, tagId) {
    const { rows } = await db.query(
      /* SQL */ `
        INSERT INTO review_tags (id_review, id_tag)
        VALUES ($1, $2)
        ON CONFLICT (id_tag, id_review) DO NOTHING
        RETURNING id_review, id_tag
      `,
      [reviewId, tagId],
    );

    return rows[0] || null;
  }

  // Supprimer tous les tags d'une review
  static async clearForReview(reviewId) {
    const result = await db.query(
      /* SQL */ `
        DELETE FROM review_tags
        WHERE id_review = $1
      `,
      [reviewId],
    );

    return result.rowCount >= 0;
  }

  // Remplacer tous les tags associés à une review
  static async replaceForReview(reviewId, tagIds) {
    // On vide d'abord les anciens tags liés à la review
    await this.clearForReview(reviewId);

    // Si aucun tag n'est fourni, on s'arrête ici
    if (!tagIds || !tagIds.length) {
      return [];
    }

    // On s'assure d'avoir une liste propre sans doublons
    const uniqueTagIds = [...new Set(Array.isArray(tagIds) ? tagIds : [tagIds])];

    const inserted = [];

    for (const tagId of uniqueTagIds) {
      const relation = await this.add(reviewId, tagId);
      if (relation) {
        inserted.push(relation);
      }
    }

    return inserted;
  }
}

export default ReviewTagRepository;
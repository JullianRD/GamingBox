"use strict";

import db from "../config/database.js";
import Review from "../entities/Review.js";

class ReviewRepository {
  // Récupère toutes les reviews d'un utilisateur
  static async findAllByUser(userId) {
    const query = /*sql*/ `
      SELECT *
      FROM v_reviews_complete
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Review(row));
  }

  // Récupère toutes les reviews d'un utilisateur filtrées par tag
  static async findAllByUserAndTag(userId, tagId) {
    const query = /*sql*/ `
      SELECT v.*
      FROM v_reviews_complete v
      JOIN (
        SELECT DISTINCT rt.id_review
        FROM review_tags rt
        JOIN reviews r
          ON r.id_review = rt.id_review
        WHERE r.user_id = $1
          AND rt.id_tag = $2
      ) filtered
        ON filtered.id_review = v.id_review
      ORDER BY v.created_at DESC;
    `;

    const { rows } = await db.query(query, [userId, tagId]);
    return rows.map((row) => new Review(row));
  }

  // Récupère toutes les reviews (admin)
  static async findAllAdmin() {
    const query = /*sql*/ `
      SELECT *
      FROM v_reviews_complete
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query);
    return rows.map((row) => new Review(row));
  }

  // Récupère une review par son id
  static async findById(id) {
    const query = /*sql*/ `
      SELECT *
      FROM v_reviews_complete
      WHERE id_review = $1
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [id]);
    return rows[0] ? new Review(rows[0]) : null;
  }

  // Récupère une review par slug
  // - user normal : slug + userId
  // - admin / global : slug seul
  static async findBySlug(slug, userId = null) {
    if (userId) {
      const query = /*sql*/ `
        SELECT *
        FROM v_reviews_complete
        WHERE slug = $1
          AND user_id = $2
        LIMIT 1;
      `;

      const { rows } = await db.query(query, [slug, userId]);
      return rows[0] ? new Review(rows[0]) : null;
    }

    const query = /*sql*/ `
      SELECT *
      FROM v_reviews_complete
      WHERE slug = $1
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [slug]);
    return rows[0] ? new Review(rows[0]) : null;
  }

  // Création d'une review
  static async create(data) {
    const query = /*sql*/ `
      INSERT INTO reviews (
        user_id,
        game_id,
        review_title,
        slug,
        review_rate,
        review_like,
        review_platine,
        progression_status,
        avis_review,
        game_platforme
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        id_review,
        user_id,
        game_id,
        review_title,
        slug,
        review_rate,
        review_like,
        review_platine,
        progression_status,
        avis_review,
        game_platforme,
        created_at,
        updated_at;
    `;

    try {
      const { rows } = await db.query(query, [
        data.userId,
        data.gameId,
        data.reviewTitle,
        data.slug,
        data.reviewRate,
        data.reviewLike === "on" || data.reviewLike === true,
        data.reviewPlatine === "on" || data.reviewPlatine === true,
        data.progressionStatus,
        data.avisReview || null,
        data.gamePlatforme || null,
      ]);

      return new Review(rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("Une review existe déjà avec ce titre");
      }
      throw error;
    }
  }

  // Mise à jour d'une review
  static async update(id, data) {
    const query = /*sql*/ `
      UPDATE reviews
      SET
        review_title = COALESCE($1, review_title),
        slug = COALESCE($2, slug),
        review_rate = COALESCE($3, review_rate),
        review_like = COALESCE($4, review_like),
        review_platine = COALESCE($5, review_platine),
        progression_status = COALESCE($6, progression_status),
        avis_review = COALESCE($7, avis_review),
        game_platforme = COALESCE($8, game_platforme),
        updated_at = NOW()
      WHERE id_review = $9
      RETURNING
        id_review,
        user_id,
        game_id,
        review_title,
        slug,
        review_rate,
        review_like,
        review_platine,
        progression_status,
        avis_review,
        game_platforme,
        created_at,
        updated_at;
    `;

    try {
      const { rows } = await db.query(query, [
        data.reviewTitle,
        data.slug,
        data.reviewRate,
        data.reviewLike,
        data.reviewPlatine,
        data.progressionStatus,
        data.avisReview,
        data.gamePlatforme,
        id,
      ]);

      return rows[0] ? new Review(rows[0]) : null;
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("Une autre review avec ce titre existe déjà.");
      }
      throw error;
    }
  }

  // Suppression d'une review
  static async delete(id) {
    const result = await db.query(
      /*sql*/ `
        DELETE FROM reviews
        WHERE id_review = $1;
      `,
      [id],
    );

    return result.rowCount > 0;
  }
}

export default ReviewRepository;
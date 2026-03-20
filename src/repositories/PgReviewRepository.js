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

  static async findByIdComplete(id) {
    const query = /*SQL*/ `
      SELECT *
      FROM v_reviews_complete
      WHERE id_review = $1;
    `;

    const { rows } = await db.query(query, [id]);
    return rows[0] ? new Review(rows[0]) : null;
  }

  // Récupère une review par son slug
  static async findBySlug(slug, userId) {
    const query = /*sql*/ `
      SELECT *
      FROM v_reviews_complete
      WHERE slug = $1 AND user_id = $2;
    `;

    const { rows } = await db.query(query, [slug, userId]);
    return rows[0] ? new Review(rows[0]) : null;
  }

  //Trouver une review avec son jeu associé
  static async findWithGameById(reviewId) {
    const query = /*SQL*/ `
      SELECT *
      FROM v_reviews_with_game
      WHERE id_review = $1
      LIMIT 1;
    `;

    const values = [reviewId];
    const { rows } = await db.query(query, values);

    return rows[0] || null;
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
    const query = /*SQL*/ `
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
        data.reviewLike === "on" || data.reviewLike === true
          ? true
          : data.reviewLike === undefined
            ? null
            : false,
        data.reviewPlatine === "on" || data.reviewPlatine === true
          ? true
          : data.reviewPlatine === undefined
            ? null
            : false,
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
      /*SQL*/ `
        DELETE FROM reviews
        WHERE id_review = $1
      `,
      [id],
    );

    return result.rowCount > 0;
  }
}

export default ReviewRepository;
"use strict";

import db from "../config/database.js";
import Review from "../entities/Review.js";
import { AppError } from "../utils/AppError.js";

const REVIEW_RETURNING = `
  id_review, user_id, game_id, review_title, slug, review_rate, review_like,
  review_platine, progression_status, avis_review, game_platforme, is_public,
  created_at, updated_at`;

const SORTS = {
  recent: "created_at DESC",
  oldest: "created_at ASC",
  rating: "review_rate DESC, created_at DESC",
  title: "game_title ASC",
};

/** Échappe % _ \ pour une recherche ILIKE littérale. */
const escapeLike = (value) => String(value).replace(/[\\%_]/g, "\\$&");

class ReviewRepository {
  // Toutes les reviews d'un utilisateur (export, statistiques)
  static async findAllByUser(userId) {
    const { rows } = await db.query(
      /*sql*/ `SELECT * FROM v_reviews_complete WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((row) => new Review(row));
  }

  // Liste paginée + filtres (page principale de l'utilisateur)
  static async search(userId, filters = {}) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(filters.perPage) || 12, 1), 50);

    const params = [userId];
    const where = ["user_id = $1"];

    if (filters.q) {
      params.push(`%${escapeLike(filters.q)}%`);
      where.push(`(review_title ILIKE $${params.length} OR game_title ILIKE $${params.length})`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`progression_status = $${params.length}::progression_status_enum`);
    }
    if (filters.platform) {
      params.push(filters.platform);
      where.push(`game_platforme = $${params.length}::game_platforme_enum`);
    }
    if (filters.tagId) {
      params.push(filters.tagId);
      where.push(
        `id_review IN (SELECT id_review FROM review_tags WHERE id_tag = $${params.length}::uuid)`,
      );
    }
    if (filters.minRate !== undefined && filters.minRate !== null && filters.minRate !== "") {
      params.push(Number(filters.minRate));
      where.push(`review_rate >= $${params.length}`);
    }

    const orderBy = SORTS[filters.sort] || SORTS.recent;
    params.push(perPage, (page - 1) * perPage);

    const { rows } = await db.query(
      /*sql*/ `
        SELECT *, COUNT(*) OVER() AS total_count
        FROM v_reviews_complete
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = rows[0] ? Number(rows[0].total_count) : 0;
    return {
      items: rows.map((row) => new Review(row)),
      total,
      page,
      perPage,
      totalPages: Math.max(Math.ceil(total / perPage), 1),
    };
  }

  static async findAllAdmin() {
    const { rows } = await db.query(
      /*sql*/ `SELECT * FROM v_reviews_complete ORDER BY created_at DESC`,
    );
    return rows.map((row) => new Review(row));
  }

  static async findById(id) {
    const { rows } = await db.query(
      /*sql*/ `SELECT * FROM v_reviews_complete WHERE id_review = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ? new Review(rows[0]) : null;
  }

  // Une review par slug, toujours rattachée à son propriétaire
  static async findBySlug(slug, userId) {
    const { rows } = await db.query(
      /*sql*/ `SELECT * FROM v_reviews_complete WHERE slug = $1 AND user_id = $2 LIMIT 1`,
      [slug, userId],
    );
    return rows[0] ? new Review(rows[0]) : null;
  }

  static async create(data, client = db) {
    try {
      const { rows } = await client.query(
        /*sql*/ `
          INSERT INTO reviews (user_id, game_id, review_title, slug, review_rate, review_like,
                               review_platine, progression_status, avis_review, game_platforme, is_public)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING ${REVIEW_RETURNING}`,
        [
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
          data.isPublic === true || data.isPublic === "on",
        ],
      );
      return new Review(rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        throw AppError.conflict("Tu as déjà une review pour ce jeu ou avec ce titre.");
      }
      if (error.code === "23503") {
        throw AppError.badRequest("Jeu introuvable.");
      }
      throw error;
    }
  }

  static async update(id, data, client = db) {
    try {
      const { rows } = await client.query(
        /*sql*/ `
          UPDATE reviews SET
            review_title = COALESCE($1, review_title),
            slug = COALESCE($2, slug),
            review_rate = COALESCE($3, review_rate),
            review_like = COALESCE($4, review_like),
            review_platine = COALESCE($5, review_platine),
            progression_status = COALESCE($6, progression_status),
            avis_review = COALESCE($7, avis_review),
            game_platforme = COALESCE($8, game_platforme),
            is_public = COALESCE($9, is_public),
            updated_at = NOW()
          WHERE id_review = $10
          RETURNING ${REVIEW_RETURNING}`,
        [
          data.reviewTitle,
          data.slug,
          data.reviewRate,
          data.reviewLike,
          data.reviewPlatine,
          data.progressionStatus,
          data.avisReview,
          data.gamePlatforme,
          data.isPublic ?? null,
          id,
        ],
      );
      return rows[0] ? new Review(rows[0]) : null;
    } catch (error) {
      if (error.code === "23505") {
        throw AppError.conflict("Une autre review avec ce titre existe déjà.");
      }
      throw error;
    }
  }

  static async delete(id, client = db) {
    const result = await client.query("DELETE FROM reviews WHERE id_review = $1", [id]);
    return result.rowCount > 0;
  }
}

export default ReviewRepository;

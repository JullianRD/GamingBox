"use strict";

import db from "../config/database.js";
import Share from "../entities/Share.js";

// ShareRepository : Stockage du partages des ressources par utilisateurs

class ShareRepository {
  // Retourne un partage par son id
  static async findById(id) {
    const query = /*SQL*/ `
      SELECT
        s.id_share,
        s.user_id,
        s.review_id,
        s.recipient_email,
        s.share_token,
        s.access_config,
        s.created_at,
        s.updated_at
      FROM shares s
      WHERE s.id_share = $1;
    `;

    const { rows } = await db.query(query, [id]);
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Tout les partages créer par un utilisateur
  static async findByUserId(userId) {
    const query = /*sql*/ `
      SELECT *
      FROM v_user_shares
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Share(row));
  }

  // Tout les partages de profil créés par un utilisateur
  static async findProfileSharesByUserId(userId) {
    const query = /*sql*/ `
      SELECT
        s.id_share,
        s.user_id,
        s.review_id,
        s.recipient_email,
        s.share_token,
        s.access_config,
        s.created_at,
        s.updated_at,
        'profile' AS share_type,
        u.id_user AS owner_id,
        u.pseudo AS owner_pseudo,
        u.avatar AS owner_avatar,
        u.biographie AS owner_biographie
      FROM shares s
      JOIN users u
        ON u.id_user = s.user_id
      WHERE s.user_id = $1
        AND s.review_id IS NULL
      ORDER BY s.created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Share(row));
  }

  // Liste des partages d'une review
  static async findByReviewId(reviewId) {
    const query = /*sql*/ `
      SELECT *
      FROM v_user_shares
      WHERE review_id = $1
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [reviewId]);
    return rows.map((row) => new Share(row));
  }

  // Accès publique par token pour une review
  static async findPublicReviewByToken(token) {
    const query = /*sql*/ `
      SELECT *
      FROM v_share_public_review
      WHERE share_token = $1;
    `;

    const { rows } = await db.query(query, [token]);
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Accès publique par token pour un profil
  static async findPublicProfileByToken(token) {
    const query = /*sql*/ `
      SELECT *
      FROM v_share_public_profile
      WHERE share_token = $1;
    `;

    const { rows } = await db.query(query, [token]);
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Vérifie si un email à déjà accès à la review
  static async existByReviewAndEmail(reviewId, email) {
    const query = /*SQL*/ `
      SELECT EXISTS (
        SELECT 1
        FROM shares
        WHERE review_id = $1
          AND LOWER(recipient_email) = LOWER($2)
      ) AS exists;
    `;

    const { rows } = await db.query(query, [reviewId, email]);
    return rows[0].exists;
  }

  // Vérifie si un email à déjà accès au profil
  static async existByProfileAndEmail(userId, email) {
    const query = /*SQL*/ `
      SELECT EXISTS (
        SELECT 1
        FROM shares
        WHERE user_id = $1
          AND review_id IS NULL
          AND LOWER(recipient_email) = LOWER($2)
      ) AS exists;
    `;

    const { rows } = await db.query(query, [userId, email]);
    return rows[0].exists;
  }

  // Création d'un partage vers une review
  static async createShareForReview(data) {
    const defaultConfig = {
      level: "read",
      allow_download: false,
      expiration: null,
      max_views: null,
      view_count: 0,
    };

    const accessConfig = {
      ...defaultConfig,
      ...(data.accessConfig || {}),
    };

    const query = /*SQL*/ `
      INSERT INTO shares (
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at;
    `;

    const values = [
      data.userId,
      data.reviewId,
      data.recipientEmail.toLowerCase().trim(),
      data.shareToken,
      JSON.stringify(accessConfig),
    ];

    const { rows } = await db.query(query, values);
    return new Share(rows[0]);
  }

  // Création d'un partage vers un profil
  static async createShareForProfile(data) {
    const defaultConfig = {
      level: "read",
      allow_download: false,
      expiration: null,
      max_views: null,
      view_count: 0,
    };

    const accessConfig = {
      ...defaultConfig,
      ...(data.accessConfig || {}),
    };

    const query = /*SQL*/ `
      INSERT INTO shares (
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config
      )
      VALUES ($1, NULL, $2, $3, $4)
      RETURNING
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at;
    `;

    const values = [
      data.userId,
      data.recipientEmail.toLowerCase().trim(),
      data.shareToken,
      JSON.stringify(accessConfig),
    ];

    const { rows } = await db.query(query, values);
    return new Share(rows[0]);
  }

  // Incrémente le compteur de vues d'un partage
  static async incrementViewCount(id) {
    const query = /*sql*/ `
      UPDATE shares
      SET
        access_config = jsonb_set(
          access_config,
          '{view_count}',
          to_jsonb(COALESCE((access_config->>'view_count')::int, 0) + 1)
        ),
        updated_at = NOW()
      WHERE id_share = $1
      RETURNING id_share;
    `;

    await db.query(query, [id]);
  }

  // Supprime un partage
  static async delete(id) {
    const result = await db.query(
      /*SQL*/ `
        DELETE FROM shares
        WHERE id_share = $1;
      `,
      [id],
    );
    return result.rowCount > 0;
  }

  // Supprime tout les partages lié à une review
  static async deleteByReviewId(reviewId) {
    const result = await db.query(
      /*SQL*/ `
        DELETE FROM shares
        WHERE review_id = $1;
      `,
      [reviewId],
    );
    return result.rowCount;
  }

  // Supprime tout les partages lié à un profil
  static async deleteByProfileId(userId) {
    const result = await db.query(
      /*SQL*/ `
        DELETE FROM shares
        WHERE user_id = $1
          AND review_id IS NULL;
      `,
      [userId],
    );
    return result.rowCount;
  }
}

export default ShareRepository;
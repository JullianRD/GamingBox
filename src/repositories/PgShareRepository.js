"use strict";

import db from "../config/database.js";
import Share from "../entities/Share.js";

// ShareRepository : stockage des partages des ressources par utilisateurs

class ShareRepository {
  // Retourne un partage par son id
  static async findById(id) {
    const query = /* SQL */ `
      SELECT
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at
      FROM shares
      WHERE id_share = $1;
    `;

    const { rows } = await db.query(query, [id]);
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Tous les partages créés par un utilisateur
  static async findByUserId(userId) {
    const query = /* SQL */ `
      SELECT
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at
      FROM shares
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Share(row));
  }

  // Tous les partages de profil créés par un utilisateur
  static async findProfileSharesByUserId(userId) {
    const query = /* SQL */ `
      SELECT
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at
      FROM shares
      WHERE user_id = $1
        AND review_id IS NULL
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Share(row));
  }

  // Tous les partages de review créés par un utilisateur
  static async findReviewSharesByUserId(userId) {
    const query = /* SQL */ `
      SELECT
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at
      FROM shares
      WHERE user_id = $1
        AND review_id IS NOT NULL
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Share(row));
  }

  // Tous les partages (admin)
  static async findAllAdmin() {
    const query = /* SQL */ `
      SELECT
        id_share,
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at
      FROM shares
      ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query);
    return rows.map((row) => new Share(row));
  }

  // Vérifie si un email a déjà accès à la review
  static async existByReviewAndEmail(reviewId, email) {
    const query = /* SQL */ `
      SELECT EXISTS (
        SELECT 1
        FROM shares
        WHERE review_id = $1
          AND LOWER(recipient_email) = LOWER($2)
      ) AS exists;
    `;

    const normalizedEmail = email?.toLowerCase().trim();
    const { rows } = await db.query(query, [reviewId, normalizedEmail]);
    return rows[0]?.exists ?? false;
  }

  // Vérifie si un email a déjà accès au profil
  static async existByProfileAndEmail(userId, email) {
    const query = /* SQL */ `
      SELECT EXISTS (
        SELECT 1
        FROM shares
        WHERE user_id = $1
          AND review_id IS NULL
          AND LOWER(recipient_email) = LOWER($2)
      ) AS exists;
    `;

    const normalizedEmail = email?.toLowerCase().trim();
    const { rows } = await db.query(query, [userId, normalizedEmail]);
    return rows[0]?.exists ?? false;
  }

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async existByProfilAndEmail(userId, email) {
    return this.existByProfileAndEmail(userId, email);
  }

  // Création d'un partage vers une review
  static async createShareForReview(data) {
    const defaultConfig = {
      level: ["read"],
      allow_download: false,
      expiration: null,
      maxViews: null,
    };

    const accessConfig = {
      ...defaultConfig,
      ...(data.accessConfig || {}),
    };

    const query = /* SQL */ `
      INSERT INTO shares (
        user_id,
        review_id,
        recipient_email,
        share_token,
        access_config
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
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
      level: ["read"],
      allow_download: false,
      expiration: null,
      maxViews: null,
    };

    const accessConfig = {
      ...defaultConfig,
      ...(data.accessConfig || {}),
    };

    const query = /* SQL */ `
      INSERT INTO shares (
        user_id,
        recipient_email,
        share_token,
        access_config
      )
      VALUES ($1, $2, $3, $4::jsonb)
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

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async createShareForProfil(data) {
    return this.createShareForProfile(data);
  }

  // Met à jour la configuration d'un partage
  static async updateAccessConfig(id, accessConfig) {
    const query = /* SQL */ `
      UPDATE shares
      SET
        access_config = COALESCE($1::jsonb, access_config),
        updated_at = NOW()
      WHERE id_share = $2
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

    const { rows } = await db.query(query, [JSON.stringify(accessConfig), id]);
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Supprime un partage
  static async delete(id) {
    const result = await db.query(
      /* SQL */ `
        DELETE FROM shares
        WHERE id_share = $1;
      `,
      [id],
    );

    return result.rowCount > 0;
  }

  // Supprime tous les partages liés à une review
  static async deleteByReviewId(reviewId) {
    const result = await db.query(
      /* SQL */ `
        DELETE FROM shares
        WHERE review_id = $1;
      `,
      [reviewId],
    );

    return result.rowCount;
  }

  // Supprime tous les partages liés à un profil
  static async deleteByProfileId(userId) {
    const result = await db.query(
      /* SQL */ `
        DELETE FROM shares
        WHERE user_id = $1
          AND review_id IS NULL;
      `,
      [userId],
    );

    return result.rowCount;
  }

  /**
   * Alias de compatibilité avec ancien nom
   */
  static async deleteByProfilId(userId) {
    return this.deleteByProfileId(userId);
  }

  // Un partage appartenant à un utilisateur donné (jamais sans filtre de propriétaire)
  static async findByIdForUser(id, userId) {
    const { rows } = await db.query(
      /* SQL */ `
        SELECT id_share, user_id, review_id, recipient_email, share_token,
               access_config, created_at, updated_at
        FROM shares
        WHERE id_share = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Révocation : seul le propriétaire du partage peut le supprimer
  static async deleteForUser(id, userId) {
    const result = await db.query("DELETE FROM shares WHERE id_share = $1 AND user_id = $2", [
      id,
      userId,
    ]);
    return result.rowCount > 0;
  }

  /**
   * Enregistre un accès public de façon atomique : le partage doit exister, ne pas
   * être expiré et n'avoir pas atteint sa limite de vues (le compteur est incrémenté
   * dans la même requête, donc deux accès simultanés ne dépassent jamais la limite).
   *
   * @param {string} token Jeton d'accès (secret de 256 bits, présent dans le lien envoyé)
   */
  static async registerAccess(token) {
    const { rows } = await db.query(
      /* SQL */ `
        UPDATE shares
        SET access_config = jsonb_set(
              access_config,
              '{view_count}',
              to_jsonb(COALESCE((access_config->>'view_count')::int, 0) + 1),
              true)
        WHERE share_token = $1
          AND (
            COALESCE(access_config->>'expiration', '') = ''
            OR (access_config->>'expiration')::timestamptz > now()
          )
          AND (
            access_config->>'maxViews' IS NULL
            OR COALESCE((access_config->>'view_count')::int, 0) < (access_config->>'maxViews')::int
          )
        RETURNING id_share, user_id, review_id, recipient_email, share_token,
                  access_config, created_at, updated_at`,
      [token],
    );
    return rows[0] ? new Share(rows[0]) : null;
  }

  // Données publiques d'une review partagée
  static async findPublicReview(shareId) {
    const { rows } = await db.query(
      /* SQL */ `
        SELECT review_title, slug, avis_review, review_rate, game_platforme, progression_status,
               review_like, review_platine, game_title, thumbnail_url, game_genre, release_date,
               user_pseudo, user_avatar
        FROM v_share_public_review WHERE id_share = $1`,
      [shareId],
    );
    return rows[0] || null;
  }

  // Données publiques d'un profil partagé
  static async findPublicProfile(shareId) {
    const { rows } = await db.query(
      /* SQL */ `
        SELECT pseudo, avatar, biographie, total_reviews, finished_games, platine_games, liked_games
        FROM v_share_public_profile WHERE id_share = $1`,
      [shareId],
    );
    return rows[0] || null;
  }
}

export default ShareRepository;

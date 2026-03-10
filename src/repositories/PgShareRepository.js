"use strict";

import db from "../config/database.js";
import Share from "../entities/Share.js";

// ShareRepository : Stockage du partages des ressources par utilisateurs 

class ShareRepository {

    // Retourne un partage de review par son id
    static async findByReviewId(id) {
        const query = /*SQL*/ `
        id_share,
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

    // Retourne un partage de profil par son id
    static async findByProfilId(id) {
        const query = /*SQL*/ `
        id_share,
        user_id,
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

    // Tout les partages créer par un utilisateur
    static async findByUserId(userId) {
    const query = /*sql*/ `
      SELECT *
        FROM v_user_shares
        WHERE from_user_id = $1
        ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [userId]);
    return rows.map((row) => new Share(row));
    }

    // Liste des partages d'une review 
    static async findByReviewId(reviewId) {
    const query = /*sql*/ `
      SELECT *
    FROM v_review_shares
    WHERE review_id = $1
    ORDER BY created_at DESC;
    `;

    const { rows } = await db.query(query, [reviewId]);
    if (rows.length === 0) return null;
    return rows.map((row) => new Share(row));
    }

    // Accès publique par token 

    static async findByToken(token) {
    const query = /*sql*/ `
      SELECT *
        FROM v_share_public_access
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
        )AS exists;
        `;
    const { rows } = await db.query(query, [reviewId, email]);
    return rows[0].exists;
    }

    // Vérifie si un email à déjà accès au profil
    static async existByProfilAndEmail(userId, email) {
        const query = /*SQL*/ `
        SELECT EXISTS (
            SELECT 1
            FROM shares 
            WHERE user_id = $1
            AND LOWER(recipient_email) = LOWER($2)
        )AS exists;
        `;
    const { rows } = await db.query(query, [userId, email]);
    return rows[0].exists;
    }

    // Compte les partages d'une review
    static async countByReviewId(reviewId) {
        const query = /*SQL*/ `
        SELECT COUNT(*) AS count
        FROM shares
        WHERE review_id = $1;
        `;

        const { rows } = await db.query(query, [reviewId]);
        return Number(rows[0].count);
    }

        // Compte les partages d'un profil
    static async countByProfilId(userId) {
        const query = /*SQL*/ `
        SELECT COUNT(*) AS count
        FROM shares
        WHERE user_id = $1;
        `;

        const { rows } = await db.query(query, [userId]);
        return Number(rows[0].count);
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

        const query = /*SQL*/ `
        INSERT INTO shares (
            review_id,
            recipient_email,
            share_token,
            access_config
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
        id_share,
        review_id,
        recipient_email,
        share_token,
        access_config,
        created_at,
        updated_at;
        `;

        const values = [
            data.reviewId,
            data.recipientEmail.toLowerCase().trim(),
            data.shareToken,
            JSON.stringify(accessConfig),
        ];

        const { rows } = await db.query(query, values);
        return new Share(rows[0]);
    }

        // Création d'un partage vers un profil
    static async createShareForProfil(data) {
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

        const query = /*SQL*/ `
        INSERT INTO shares (
            user_id,
            recipient_email,
            share_token,
            access_config
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
        id_share,
        user_id,
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

    // Met à jour la configuration d'un partage d'une review 

    static async updateAccessConfigReview(id, accessConfig) {
    const query = /*sql*/ `
        UPDATE shares
        SET
        access_config = COALESCE($1, access_config)::jsonb,
        updated_at = NOW()
        WHERE id_share = $2
        RETURNING
        id_share,
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

    static async updateAccessConfigProfil(id, accessConfig) {
    const query = /*sql*/ `
        UPDATE shares
        SET
        access_config = COALESCE($1, access_config)::jsonb,
        updated_at = NOW()
        WHERE id_share = $2
        RETURNING
        id_share,
        user_id,
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
            /*SQL*/ `
            DELETE FROM shares
            WHERE id_share = $1;`, [id,]
        );
        return result.rowCount > 0;
    }

    // Supprime tout les partages lié à une review 
    static async deleteByReviewId(reviewId) {
        const result = await db.query(
            /*SQL*/ `
            DELETE FROM shares
            WHERE review_id = $1;`, [reviewId]
        );
        return result.rowCount;
    }

    // Supprime tout les partages lié à un profil
    static async deleteByProfilId(reviewId) {
        const result = await db.query(
            /*SQL*/ `
            DELETE FROM shares
            WHERE user_id = $1;`, [userId]
        );
        return result.rowCount;
    }
}

export default ShareRepository;
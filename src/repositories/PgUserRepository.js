"use strict"

import db from "../config/database.js";
import User from "../entities/User.js";

/**
 * UserRepository
 *
 * Règles :
 * - Écriture : table `users`
 * - Lecture UI / Admin : vues SQL
 */

class UserRepository {

    // Retourne un utilisateur par son identifiant (usage interne)

    static async findById(id) {
        const query = /*SQL*/ `
        SELECT
        id_user,
        email,
        password_hash,
        pseudo,
        biographie,
        role_name,
        auth_provider
        settings_user,
        gdpr_consent,
        gdpr_consent_date,
        created_at,
        updated_at
        FROM users
        WHERE id_user = $1;
        `;
        const { rows } = await db.query(query, [id]);
        return rows[0] ? new User(rows[0]) : null;
    }


    // Retourne un utilisateur par son email (sert pour l'authentification)

    static async findByEmail(email) {
        const query = /*SQL*/ `
        SELECT
        id_user,
        email,
        password_hash,
        pseudo,
        role_name,
        auth_provider,
        settings_user,
        gdpr_consent,
        gdpr_consent_date,
        created_at,
        updated_at
        FROM users
        WHERE LOWER(email) = LOWER($1);
        `;

        const { rows } = await db.query(query, [email]);
        return rows[0] ? new User(rows[0]) : null
    }

    // Liste des utilisateurs de l'application (reservé aux admins) 

    static async findAllAdmin() {
        const query = /*SQL*/ `
        SELECT *
        FROM v_users_admin
        ORDER BY created_at DESC;
        `;

        const { rows } = await db.query(query);
        if (rows.length === 0) return null;
        return rows.map((row) => new User(row));
    }

    // Affiche le profil utilisateur avec ses statistiques

    static async findProfilWithStats(id) {
        const query = /*SQL*/ `
        SELECT *
        FROM v_user_profil_with_stats
        WHERE id_user = $1;
        `;

        const { rows } = await db.query(query, [id]);
        return rows[0] ? new User(rows[0]) : null;
    }
}
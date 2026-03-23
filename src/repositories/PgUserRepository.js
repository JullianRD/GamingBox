"use strict";

import db from "../config/database.js";
import User from "../entities/Users.js";

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
        avatar,
        role_name,
        auth_provider,
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
        biographie,
        avatar,
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
    return rows[0] ? new User(rows[0]) : null;
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

  // Vérifie si un email existe (pour l'authentification)
  static async existByEmail(email) {
    const query = /*SQL*/ `
      SELECT EXISTS (
        SELECT 1 FROM users
        WHERE LOWER(email) = LOWER($1)
      ) AS exists;
    `;
    const { rows } = await db.query(query, [email]);
    return rows[0].exists;
  }

  // Vérifier si un pseudo existe (pour l'authentification)
  static async existByPseudo(pseudo) {
    const query = /*SQL*/ `
      SELECT EXISTS (
        SELECT 1 FROM users
        WHERE LOWER(pseudo) = LOWER($1)
      ) AS exists;
    `;
    const { rows } = await db.query(query, [pseudo]);
    return rows[0].exists;
  }

  // Créer un nouvel utilisateur

  static async create(data) {
    const query = /*SQL*/ `
      INSERT INTO users (
        email,
        password_hash,
        pseudo,
        biographie,
        avatar,
        auth_provider,
        settings_user,
        gdpr_consent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id_user,
        email,
        pseudo,
        biographie,
        avatar,
        role_name,
        auth_provider,
        settings_user,
        gdpr_consent,
        gdpr_consent_date,
        created_at,
        updated_at
    `;

    const values = [
      data.email?.toLowerCase().trim(),
      data.passwordHash,
      data.pseudo?.trim(),
      data.biographie ?? null,
      data.avatar ?? null,
      data.authProvider || "local",
      JSON.stringify(data.settingsUser || {}),
      data.gdprConsent,
    ];

    console.log("=== USER CREATE START ===");
    console.log("DATA:", data);
    console.log("VALUES:", values);

    try {
      const { rows } = await db.query(query, values);
      console.log("ROWS:", rows);
      console.log("=== USER CREATE END ===");
      return new User(rows[0]);
    } catch (error) {
      console.error("=== USER CREATE ERROR ===");
      console.error(error);

      if (error.code === "23505") {
        throw new Error("Email ou pseudo déjà utilisé.");
      }

      throw error;
    }
  }

  // Met à jour un utilisateur
  // Coalesce -> sert à chosir sois la nouvelle valeur entré ($1) sois la valeur existante en base
  static async update(id, data) {
    const query = /*SQL*/ `
      UPDATE users
      SET
        email = COALESCE($1, email),
        password_hash = COALESCE($2, password_hash),
        pseudo = COALESCE($3, pseudo),
        biographie = COALESCE($4, biographie),
        avatar = COALESCE($5, avatar),
        settings_user = COALESCE($6, settings_user)::jsonb,
        updated_at = NOW()
      WHERE id_user = $7
      RETURNING
        id_user,
        email,
        pseudo,
        biographie,
        avatar,
        role_name,
        auth_provider,
        settings_user,
        gdpr_consent,
        gdpr_consent_date,
        created_at,
        updated_at;
    `;

    const values = [
      data.email?.toLowerCase().trim(),
      data.passwordHash,
      data.pseudo?.trim(),
      data.biographie ?? null,
      data.avatar ?? null,
      data.settingsUser ? JSON.stringify(data.settingsUser) : null,
      id,
    ];

    const { rows } = await db.query(query, values);
    return rows[0] ? new User(rows[0]) : null;
  }

  // Texte en minuscule (tolowercase) + supprime les espaces (trim)

  // Met à jour les préférences de l'utilisateur

  static async updateSettings(id, settings) {
    const query = /*sql*/ `
      UPDATE users
      SET
        settings_user = settings_user || $1::jsonb,
        updated_at = NOW()
      WHERE id_user = $2
      RETURNING
        id_user,
        email,
        pseudo,
        biographie,
        avatar,
        role_name,
        auth_provider,
        settings_user,
        gdpr_consent,
        created_at,
        updated_at;
    `;

    const { rows } = await db.query(query, [JSON.stringify(settings), id]);

    return rows[0] ? new User(rows[0]) : null;
  }

  // Supprimer un utilisateur (RGPD)

  static async delete(id) {
    const result = await db.query(
      /*SQL*/ `
        DELETE FROM users
        WHERE id_user = $1;
      `,
      [id],
    );
    return result.rowCount > 0;
  }
}

export default UserRepository;
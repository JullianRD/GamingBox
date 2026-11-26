"use strict";

import db from "../config/database.js";
import User from "../entities/Users.js";
import { AppError } from "../utils/AppError.js";

/**
 * UserRepository
 * - Écriture : table `users`
 * - Lecture : table directe (colonnes explicites, jamais `SELECT *`)
 */

const PUBLIC_COLUMNS = `
  id_user, email, pseudo, biographie, avatar, role_name, auth_provider,
  settings_user, gdpr_consent, gdpr_consent_date, email_verified_at,
  profile_public, created_at, updated_at`;

const FULL_COLUMNS = `password_hash, ${PUBLIC_COLUMNS}`;

class UserRepository {
  static async findById(id) {
    const { rows } = await db.query(`SELECT ${FULL_COLUMNS} FROM users WHERE id_user = $1`, [id]);
    return rows[0] ? new User(rows[0]) : null;
  }

  static async findByEmail(email) {
    const { rows } = await db.query(`SELECT ${FULL_COLUMNS} FROM users WHERE email = $1`, [email]);
    return rows[0] ? new User(rows[0]) : null;
  }

  static async findByPseudo(pseudo) {
    const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE pseudo = $1`, [pseudo]);
    return rows[0] ? new User(rows[0]) : null;
  }

  static async findAllAdmin() {
    const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`);
    return rows.map((row) => new User(row));
  }

  // email et pseudo sont CITEXT : la comparaison est déjà insensible à la casse (et indexée)
  static async existByEmail(email) {
    const { rows } = await db.query("SELECT EXISTS (SELECT 1 FROM users WHERE email = $1) AS exists", [email]);
    return rows[0].exists;
  }

  static async existByPseudo(pseudo) {
    const { rows } = await db.query("SELECT EXISTS (SELECT 1 FROM users WHERE pseudo = $1) AS exists", [pseudo]);
    return rows[0].exists;
  }

  static async create(data) {
    const gdprConsent = Boolean(data.gdprConsent);

    try {
      const { rows } = await db.query(
        /*sql*/ `
          INSERT INTO users (email, password_hash, pseudo, biographie, avatar, auth_provider,
                             settings_user, gdpr_consent, gdpr_consent_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, CASE WHEN $8 THEN now() ELSE NULL END)
          RETURNING ${PUBLIC_COLUMNS}`,
        [
          data.email?.toLowerCase().trim(),
          data.passwordHash,
          data.pseudo?.trim(),
          data.biographie ?? null,
          data.avatar ?? null,
          data.authProvider || "local",
          JSON.stringify(data.settingsUser || {}),
          gdprConsent,
        ],
      );
      return new User(rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        throw AppError.conflict("Email ou pseudo déjà utilisé.");
      }
      throw error;
    }
  }

  static async update(id, data) {
    try {
      const { rows } = await db.query(
        /*sql*/ `
          UPDATE users SET
            email = COALESCE($1, email),
            password_hash = COALESCE($2, password_hash),
            pseudo = COALESCE($3, pseudo),
            biographie = COALESCE($4, biographie),
            avatar = COALESCE($5, avatar),
            settings_user = COALESCE($6::jsonb, settings_user),
            profile_public = COALESCE($7, profile_public),
            updated_at = NOW()
          WHERE id_user = $8
          RETURNING ${PUBLIC_COLUMNS}`,
        [
          data.email?.toLowerCase().trim() ?? null,
          data.passwordHash ?? null,
          data.pseudo?.trim() ?? null,
          data.biographie ?? null,
          data.avatar ?? null,
          data.settingsUser ? JSON.stringify(data.settingsUser) : null,
          data.profilePublic ?? null,
          id,
        ],
      );
      return rows[0] ? new User(rows[0]) : null;
    } catch (error) {
      if (error.code === "23505") throw AppError.conflict("Ce pseudo est déjà utilisé.");
      throw error;
    }
  }

  static async updateSettings(id, settings) {
    const { rows } = await db.query(
      /*sql*/ `
        UPDATE users SET settings_user = settings_user || $1::jsonb, updated_at = NOW()
        WHERE id_user = $2 RETURNING ${PUBLIC_COLUMNS}`,
      [JSON.stringify(settings), id],
    );
    return rows[0] ? new User(rows[0]) : null;
  }

  static async markEmailVerified(id) {
    const result = await db.query(
      "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id_user = $1",
      [id],
    );
    return result.rowCount > 0;
  }

  static async updatePassword(id, passwordHash) {
    const result = await db.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id_user = $2",
      [passwordHash, id],
    );
    return result.rowCount > 0;
  }

  static async delete(id) {
    const result = await db.query("DELETE FROM users WHERE id_user = $1", [id]);
    return result.rowCount > 0;
  }
}

export default UserRepository;

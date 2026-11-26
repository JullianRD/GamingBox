"use strict";

import db from "../config/database.js";
import AppEvent from "../entities/appEvent.js";

const COLUMNS = `id_event, user_id, event_category, event_type, severity, message, metadata, created_at`;

class AppEventRepository {
  static async create(data) {
    const { rows } = await db.query(
      /*sql*/ `
        INSERT INTO app_events (user_id, event_category, event_type, severity, message, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING ${COLUMNS}
      `,
      [
        data.userId ?? null,
        data.eventCategory,
        data.eventType,
        data.severity ?? "info",
        data.message ?? null,
        JSON.stringify(data.metadata ?? {}),
      ],
    );
    return new AppEvent(rows[0]);
  }

  static async findAll({ limit = 50, offset = 0 } = {}) {
    const { rows } = await db.query(
      /*sql*/ `SELECT ${COLUMNS} FROM app_events ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [Math.min(limit, 200), offset],
    );
    return rows.map((row) => new AppEvent(row));
  }

  static async findById(id) {
    const { rows } = await db.query(`SELECT ${COLUMNS} FROM app_events WHERE id_event = $1`, [id]);
    return rows[0] ? new AppEvent(rows[0]) : null;
  }

  static async findByUserId(userId, limit = 50) {
    const { rows } = await db.query(
      /*sql*/ `SELECT ${COLUMNS} FROM app_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map((row) => new AppEvent(row));
  }

  static async findCritical(limit = 100) {
    const { rows } = await db.query(
      /*sql*/ `SELECT ${COLUMNS} FROM app_events WHERE severity = 'critical' ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((row) => new AppEvent(row));
  }

  static async findErrors({ limit = 50 } = {}) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${COLUMNS} FROM app_events
        WHERE severity IN ('error', 'critical')
        ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((row) => new AppEvent(row));
  }

  static async count() {
    const { rows } = await db.query("SELECT COUNT(*)::int AS total FROM app_events");
    return rows[0].total;
  }

  static async countByType() {
    const { rows } = await db.query(/*sql*/ `
      SELECT event_category, event_type, COUNT(*)::int AS total
      FROM app_events GROUP BY event_category, event_type ORDER BY total DESC`);
    return rows;
  }

  static async countByDay({ days = 30 } = {}) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS total
        FROM app_events
        WHERE created_at >= now() - ($1::int * interval '1 day')
        GROUP BY 1 ORDER BY 1`,
      [days],
    );
    return rows;
  }

  static async topUsers({ limit = 10 } = {}) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT e.user_id, u.pseudo, COUNT(*)::int AS total
        FROM app_events e JOIN users u ON u.id_user = e.user_id
        GROUP BY e.user_id, u.pseudo ORDER BY total DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  static async delete(id) {
    const result = await db.query("DELETE FROM app_events WHERE id_event = $1", [id]);
    return result.rowCount > 0;
  }

  static async deleteOlderThan(cutoffDate) {
    const result = await db.query("DELETE FROM app_events WHERE created_at < $1", [cutoffDate]);
    return result.rowCount;
  }
}

export default AppEventRepository;

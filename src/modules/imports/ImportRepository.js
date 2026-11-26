"use strict";

import db from "../../config/database.js";

export const toImport = (row) =>
  row
    ? {
        id: row.id_import,
        userId: row.user_id,
        source: row.source,
        label: row.label,
        status: row.status,
        options: row.options ?? {},
        total: row.total,
        processed: row.processed,
        error: row.error,
        counts: row.counts ?? {},
        createdAt: row.created_at,
        finishedAt: row.finished_at,
      }
    : null;

const toRow = (row) => ({
  id: row.id_import_row,
  position: row.position,
  data: row.data,
  state: row.state,
  match: row.match,
  candidates: row.candidates ?? [],
});

const COUNTS = `
  (SELECT json_object_agg(state, n) FROM (
     SELECT state, COUNT(*)::int AS n FROM import_rows WHERE import_id = imports.id_import GROUP BY state
   ) c) AS counts
`;

class ImportRepository {
  // Crée l'import et ses lignes en une transaction
  static async create(userId, { source, label, options, rows }) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows: created } = await client.query(
        `INSERT INTO imports (user_id, source, label, options, total) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, source, label?.slice(0, 200) ?? null, options ?? {}, rows.length],
      );
      const importId = created[0].id_import;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await client.query(
          `INSERT INTO import_rows (import_id, position, data)
           SELECT $1, p, d FROM unnest($2::int[], $3::jsonb[]) AS t(p, d)`,
          [importId, chunk.map((_, j) => i + j), chunk.map((r) => JSON.stringify(r))],
        );
      }
      await client.query("COMMIT");
      return toImport(created[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async findForUser(importId, userId) {
    const { rows } = await db.query(`SELECT imports.*, ${COUNTS} FROM imports WHERE id_import = $1 AND user_id = $2`, [importId, userId]);
    return toImport(rows[0]);
  }

  static async findById(importId) {
    const { rows } = await db.query(`SELECT imports.*, ${COUNTS} FROM imports WHERE id_import = $1`, [importId]);
    return toImport(rows[0]);
  }

  static async findAllByUser(userId, limit = 10) {
    const { rows } = await db.query(
      `SELECT imports.*, ${COUNTS} FROM imports WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map(toImport);
  }

  static async findRunning() {
    const { rows } = await db.query(`SELECT id_import FROM imports WHERE status IN ('matching', 'applying')`);
    return rows.map((r) => r.id_import);
  }

  static async setStatus(importId, status, { error = null } = {}) {
    await db.query(
      `UPDATE imports SET status = $2::import_status_enum, error = $3,
         processed = CASE WHEN $2::text IN ('matching', 'applying') THEN 0 ELSE processed END,
         finished_at = CASE WHEN $2::text IN ('done', 'failed') THEN NOW() ELSE finished_at END
       WHERE id_import = $1`,
      [importId, status, error],
    );
  }

  static async setProcessed(importId, processed) {
    await db.query(`UPDATE imports SET processed = $2 WHERE id_import = $1`, [importId, processed]);
  }

  static async findRowsByState(importId, states, { limit = 1000, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT * FROM import_rows WHERE import_id = $1 AND state = ANY($2::import_row_state_enum[])
       ORDER BY position LIMIT $3 OFFSET $4`,
      [importId, states, limit, offset],
    );
    return rows.map(toRow);
  }

  static async countRows(importId, states) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM import_rows WHERE import_id = $1 AND state = ANY($2::import_row_state_enum[])`,
      [importId, states],
    );
    return rows[0].n;
  }

  static async findRow(rowId, importId) {
    const { rows } = await db.query(`SELECT * FROM import_rows WHERE id_import_row = $1 AND import_id = $2`, [rowId, importId]);
    return rows[0] ? toRow(rows[0]) : null;
  }

  static async updateRow(rowId, { state, match = null, candidates = [] }) {
    const { rows } = await db.query(
      `UPDATE import_rows SET state = $2, match = $3, candidates = $4 WHERE id_import_row = $1 RETURNING *`,
      [rowId, state, match ? JSON.stringify(match) : null, JSON.stringify(candidates)],
    );
    return rows[0] ? toRow(rows[0]) : null;
  }

  static async setRowState(rowId, state) {
    await db.query(`UPDATE import_rows SET state = $2 WHERE id_import_row = $1`, [rowId, state]);
  }

  static async delete(importId, userId) {
    const { rowCount } = await db.query(`DELETE FROM imports WHERE id_import = $1 AND user_id = $2`, [importId, userId]);
    return rowCount > 0;
  }
}

export default ImportRepository;

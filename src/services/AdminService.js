"use strict";

import db from "../config/database.js";

/**
 * Administration : chiffres clés, utilisateurs, catalogue et modération des commentaires.
 */
class AdminService {
  static async getDashboard() {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM items) AS items,
        (SELECT COUNT(*)::int FROM user_items) AS entries,
        (SELECT COUNT(*)::int FROM lists) AS lists,
        (SELECT COUNT(*)::int FROM entry_comments) AS comments,
        (SELECT COUNT(*)::int FROM activities WHERE created_at > now() - interval '7 days') AS activity_week
    `);
    const { rows: byType } = await db.query(
      `SELECT item_type, COUNT(*)::int AS count FROM items GROUP BY item_type ORDER BY count DESC`,
    );
    return { counts: rows[0], byType };
  }

  static async getUsers() {
    const { rows } = await db.query(`
      SELECT u.id_user, u.pseudo, u.email, u.role_name, u.is_public, u.created_at,
        (SELECT COUNT(*)::int FROM user_items ui WHERE ui.user_id = u.id_user) AS entries
      FROM users u ORDER BY u.created_at DESC
    `);
    return rows;
  }

  static async getItems() {
    const { rows } = await db.query(`
      SELECT i.id_item, i.item_type, i.source, i.external_id, i.title, i.created_at,
        (SELECT COUNT(*)::int FROM user_items ui WHERE ui.item_id = i.id_item) AS entries
      FROM items i ORDER BY i.created_at DESC LIMIT 500
    `);
    return rows;
  }

  static async getComments() {
    const { rows } = await db.query(`
      SELECT c.id_comment, c.body, c.created_at, a.pseudo AS author, o.pseudo AS owner, i.title, c.user_item_id
      FROM entry_comments c
      JOIN users a ON a.id_user = c.author_id
      JOIN user_items ui ON ui.id_user_item = c.user_item_id
      JOIN users o ON o.id_user = ui.user_id
      JOIN items i ON i.id_item = ui.item_id
      ORDER BY c.created_at DESC LIMIT 200
    `);
    return rows;
  }

  // Un admin ne peut pas supprimer son propre compte depuis l'admin
  static async deleteUser(userId, adminId) {
    if (userId === adminId) return false;
    const { rowCount } = await db.query(`DELETE FROM users WHERE id_user = $1`, [userId]);
    return rowCount > 0;
  }

  static async deleteItem(itemId) {
    const { rowCount } = await db.query(`DELETE FROM items WHERE id_item = $1`, [itemId]);
    return rowCount > 0;
  }

  static async deleteComment(commentId) {
    const { rowCount } = await db.query(`DELETE FROM entry_comments WHERE id_comment = $1`, [commentId]);
    return rowCount > 0;
  }
}

export default AdminService;

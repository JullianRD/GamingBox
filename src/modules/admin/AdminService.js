"use strict";

import db from "../../config/database.js";
import ItemRepository, { toItem } from "../catalog/ItemRepository.js";
import { getProvider } from "../catalog/providers/index.js";
import { snapshot as apiSnapshot } from "../catalog/stats.js";
import { waitTime } from "../catalog/rateLimit.js";
import { isStale } from "../catalog/CatalogService.js";
import { AppError } from "../../utils/AppError.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";
import { logAdminAction } from "./AuditLog.js";

export const PER_PAGE = 30;
export const ROLES = ["customer", "admin"];

const page = (value) => Math.max(1, Math.min(10_000, Number.parseInt(value, 10) || 1));
const text = (value, max = 100) => String(value ?? "").trim().slice(0, max);
const likeEscape = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const withTotal = (rows) => ({ total: rows[0]?.total ?? 0, rows });

// Ferme toutes les sessions d'un utilisateur (suspension, suppression)
const closeSessions = (userId, client = db) =>
  client.query(`DELETE FROM user_sessions WHERE sess->>'userId' = $1`, [userId]);

class AdminService {
  // ── Vue d'ensemble ──
  static async getDashboard() {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE suspended_at IS NOT NULL) AS suspended,
        (SELECT COUNT(*)::int FROM users WHERE created_at > now() - interval '7 days') AS new_users,
        (SELECT COUNT(*)::int FROM items) AS items,
        (SELECT COUNT(*)::int FROM items WHERE NOT metadata ? 'detailed') AS light_items,
        (SELECT COUNT(*)::int FROM user_items) AS entries,
        (SELECT COUNT(*)::int FROM lists) AS lists,
        (SELECT COUNT(*)::int FROM entry_comments) AS comments,
        (SELECT COUNT(*)::int FROM activities WHERE created_at > now() - interval '7 days') AS activity_week,
        (SELECT COUNT(*)::int FROM reports WHERE status = 'open') AS open_reports,
        (SELECT COUNT(*)::int FROM imports WHERE status IN ('matching', 'applying')) AS running_imports,
        (SELECT COUNT(*)::int FROM imports WHERE status = 'failed' AND created_at > now() - interval '7 days') AS failed_imports
    `);
    const { rows: byType } = await db.query(
      `SELECT item_type, COUNT(*)::int AS count FROM items GROUP BY item_type ORDER BY count DESC`,
    );
    return { counts: rows[0], byType };
  }

  // ── Utilisateurs ──
  static async listUsers(query = {}) {
    const q = text(query.q);
    const role = ROLES.includes(query.role) ? query.role : null;
    const status = ["active", "suspended"].includes(query.status) ? query.status : null;
    const current = page(query.page);
    const { rows } = await db.query(
      `
        SELECT u.id_user, u.pseudo, u.email, u.role_name, u.is_public, u.created_at, u.last_login_at,
               u.suspended_at, u.avatar,
               (SELECT COUNT(*)::int FROM user_items ui WHERE ui.user_id = u.id_user) AS entries,
               COUNT(*) OVER()::int AS total
        FROM users u
        WHERE ($1 = '' OR u.pseudo ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
          AND ($2::role_enum IS NULL OR u.role_name = $2)
          AND ($3::text IS NULL OR ($3 = 'suspended') = (u.suspended_at IS NOT NULL))
        ORDER BY u.created_at DESC
        LIMIT $4 OFFSET $5
      `,
      [likeEscape(q), role, status, PER_PAGE, (current - 1) * PER_PAGE],
    );
    return { ...withTotal(rows), page: current, filters: { q, role, status } };
  }

  static async getUser(userId) {
    const { rows } = await db.query(
      `SELECT id_user, pseudo, email, role_name, is_public, created_at, last_login_at, suspended_at, suspended_reason, avatar, biographie
       FROM users WHERE id_user = $1`,
      [userId],
    );
    if (!rows[0]) throw new AppError("Utilisateur introuvable.", 404);
    const [byType, activity, imports, stats] = await Promise.all([
      db.query(
        `SELECT i.item_type, COUNT(*)::int AS count FROM user_items ui JOIN items i ON i.id_item = ui.item_id
         WHERE ui.user_id = $1 GROUP BY i.item_type ORDER BY count DESC`,
        [userId],
      ),
      db.query(
        `SELECT a.kind, a.created_at, i.title FROM activities a LEFT JOIN items i ON i.id_item = a.item_id
         WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 8`,
        [userId],
      ),
      db.query(
        `SELECT id_import, source, label, status, total, created_at FROM imports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [userId],
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM entry_comments WHERE author_id = $1) AS comments,
           (SELECT COUNT(*)::int FROM lists WHERE user_id = $1) AS lists,
           (SELECT COUNT(*)::int FROM follows WHERE followed_id = $1) AS followers,
           (SELECT COUNT(*)::int FROM reports WHERE status = 'open' AND (
              (target_type = 'user' AND target_id = $1) OR
              (target_type = 'comment' AND target_id IN (SELECT id_comment FROM entry_comments WHERE author_id = $1))
           )) AS open_reports,
           GREATEST(
             (SELECT MAX(created_at) FROM activities WHERE user_id = $1),
             (SELECT MAX(COALESCE(updated_at, created_at)) FROM user_items WHERE user_id = $1)
           ) AS last_activity`,
        [userId],
      ),
    ]);
    return { user: rows[0], byType: byType.rows, activity: activity.rows, imports: imports.rows, stats: stats.rows[0] };
  }

  static async #target(userId) {
    const { rows } = await db.query(`SELECT id_user, pseudo, role_name, suspended_at FROM users WHERE id_user = $1`, [userId]);
    if (!rows[0]) throw new AppError("Utilisateur introuvable.", 404);
    return rows[0];
  }

  static async setRole(adminId, userId, role) {
    if (!ROLES.includes(role)) throw new AppError("Rôle inconnu.", 400);
    if (userId === adminId) throw new AppError("Tu ne peux pas changer ton propre rôle.", 400);
    const target = await AdminService.#target(userId);
    if (target.role_name === role) return target;
    if (target.role_name === "admin") {
      const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_name = 'admin' AND suspended_at IS NULL`);
      if (rows[0].n <= 1) throw new AppError("Il faut garder au moins un administrateur.", 400);
    }
    await db.query(`UPDATE users SET role_name = $2 WHERE id_user = $1`, [userId, role]);
    // Les sessions ouvertes prennent le nouveau rôle tout de suite
    await db.query(
      `UPDATE user_sessions SET sess = jsonb_set(sess::jsonb, '{roleName}', to_jsonb($2::text))::json WHERE sess->>'userId' = $1`,
      [userId, role],
    );
    await logAdminAction(adminId, "user.role", {
      targetType: "user",
      targetId: userId,
      label: target.pseudo,
      details: { from: target.role_name, to: role },
    });
    return { ...target, role_name: role };
  }

  static async suspend(adminId, userId, reason) {
    if (userId === adminId) throw new AppError("Tu ne peux pas suspendre ton propre compte.", 400);
    const target = await AdminService.#target(userId);
    if (target.role_name === "admin") throw new AppError("Retire d'abord le rôle administrateur.", 400);
    const why = text(reason, 300) || null;
    await db.query(`UPDATE users SET suspended_at = NOW(), suspended_reason = $2 WHERE id_user = $1`, [userId, why]);
    await closeSessions(userId);
    await logAdminAction(adminId, "user.suspend", { targetType: "user", targetId: userId, label: target.pseudo, details: { reason: why } });
  }

  static async unsuspend(adminId, userId) {
    const target = await AdminService.#target(userId);
    await db.query(`UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE id_user = $1`, [userId]);
    await logAdminAction(adminId, "user.unsuspend", { targetType: "user", targetId: userId, label: target.pseudo });
  }

  // Un admin ne peut pas supprimer son propre compte depuis l'admin
  static async deleteUser(adminId, userId) {
    if (userId === adminId) throw new AppError("Tu ne peux pas supprimer ton propre compte ici.", 400);
    const target = await AdminService.#target(userId);
    if (target.role_name === "admin") throw new AppError("Retire d'abord le rôle administrateur.", 400);
    await closeSessions(userId);
    await db.query(`DELETE FROM users WHERE id_user = $1`, [userId]);
    await logAdminAction(adminId, "user.delete", { targetType: "user", targetId: userId, label: target.pseudo });
  }

  // ── Catalogue ──
  static async listItems(query = {}) {
    const q = text(query.q);
    const type = ITEM_TYPES[query.type] ? query.type : null;
    const source = /^[a-z]{2,20}$/.test(query.source ?? "") ? query.source : null;
    const quality = ["light", "detailed", "edited"].includes(query.quality) ? query.quality : null;
    const current = page(query.page);
    const { rows } = await db.query(
      `
        SELECT i.*, (SELECT COUNT(*)::int FROM user_items ui WHERE ui.item_id = i.id_item) AS entries,
               COUNT(*) OVER()::int AS total
        FROM items i
        WHERE ($1 = '' OR i.title ILIKE '%' || $1 || '%' OR i.external_id = $6)
          AND ($2::item_type_enum IS NULL OR i.item_type = $2)
          AND ($3::text IS NULL OR i.source = $3)
          AND ($4::text IS NULL
               OR ($4 = 'light' AND NOT i.metadata ? 'detailed')
               OR ($4 = 'detailed' AND i.metadata ? 'detailed')
               OR ($4 = 'edited' AND i.metadata ? 'adminEdited'))
        ORDER BY i.created_at DESC
        LIMIT $5 OFFSET $7
      `,
      [likeEscape(q), type, source, quality, PER_PAGE, q, (current - 1) * PER_PAGE],
    );
    const { rows: sources } = await db.query(`SELECT DISTINCT source FROM items ORDER BY source`);
    return {
      total: rows[0]?.total ?? 0,
      rows: rows.map((row) => ({ ...toItem(row), entries: row.entries })),
      page: current,
      filters: { q, type, source, quality },
      sources: sources.map((s) => s.source),
    };
  }

  static async getItem(itemId) {
    const item = await ItemRepository.findById(itemId);
    if (!item) throw new AppError("Œuvre introuvable.", 404);
    const { rows: usage } = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM user_items WHERE item_id = $1) AS entries,
         (SELECT COUNT(*)::int FROM list_items WHERE item_id = $1) AS lists,
         (SELECT COUNT(*)::int FROM item_entities WHERE item_id = $1) AS entities`,
      [itemId],
    );
    // Doublons possibles : même catégorie, titre proche, autre fiche
    const { rows: dupes } = await db.query(
      `
        SELECT i.*, (SELECT COUNT(*)::int FROM user_items ui WHERE ui.item_id = i.id_item) AS entries
        FROM items i
        WHERE i.item_type = $2 AND i.id_item <> $1 AND i.parent_item_id IS NULL
          AND (i.title % $3 OR i.title ILIKE '%' || $4 || '%')
        ORDER BY similarity(i.title::text, $3) DESC
        LIMIT 6
      `,
      [itemId, item.type, item.title, likeEscape(item.title)],
    );
    return {
      item,
      usage: usage[0],
      stale: isStale(item),
      duplicates: dupes.map((row) => ({ ...toItem(row), entries: row.entries })),
    };
  }

  static async editItem(adminId, itemId, body = {}) {
    const item = await ItemRepository.findById(itemId);
    if (!item) throw new AppError("Œuvre introuvable.", 404);
    const title = text(body.title, 300);
    if (!title) throw new AppError("Le titre est obligatoire.", 400);
    const coverUrl = text(body.coverUrl, 500) || null;
    if (coverUrl && !/^https:\/\/\S+$/.test(coverUrl)) throw new AppError("La jaquette doit être une adresse https.", 400);
    const releaseDate = text(body.releaseDate, 10) || null;
    if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new AppError("Date au format AAAA-MM-JJ.", 400);
    const genres = text(body.genres, 300)
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 6);
    await db.query(
      `UPDATE items SET title = $2, cover_url = $3, release_date = $4, genres = $5,
              metadata = metadata || jsonb_build_object('adminEdited', now())
       WHERE id_item = $1`,
      [itemId, title, coverUrl, releaseDate, genres],
    );
    await logAdminAction(adminId, "item.edit", { targetType: "item", targetId: itemId, label: title, details: { before: item.title } });
  }

  // Relit la fiche chez sa source, sans toucher aux champs corrigés à la main
  static async refreshItem(adminId, itemId) {
    const item = await ItemRepository.findById(itemId);
    if (!item) throw new AppError("Œuvre introuvable.", 404);
    const provider = getProvider(item.source);
    if (!provider?.fetchItem || provider.configured?.() === false) throw new AppError("Source non configurée.", 400);
    let fetched;
    try {
      fetched = await provider.fetchItem(item.externalId);
    } catch (error) {
      throw new AppError(`Relecture impossible : ${error.message}`, 400);
    }
    if (!fetched) throw new AppError("La source ne connaît plus cette œuvre.", 400);
    await ItemRepository.upsert({ ...fetched, metadata: { ...fetched.metadata, detailed: true } });
    await logAdminAction(adminId, "item.refresh", { targetType: "item", targetId: itemId, label: item.title });
  }

  /**
   * Fusionne un doublon (source) dans l'œuvre gardée (target), en une transaction.
   * Les entrées des utilisateurs suivent ; si quelqu'un suivait les deux, on garde
   * l'entrée cible et on la complète (note, avis, dates, tags, tomes, commentaires).
   */
  static async mergeItems(adminId, sourceId, targetId) {
    if (sourceId === targetId) throw new AppError("Choisis deux fiches différentes.", 400);
    const [source, target] = await Promise.all([ItemRepository.findById(sourceId), ItemRepository.findById(targetId)]);
    if (!source || !target) throw new AppError("Œuvre introuvable.", 404);
    if (source.type !== target.type) throw new AppError("Les deux fiches doivent être de la même catégorie.", 400);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // Utilisateurs qui suivent les deux : on complète l'entrée gardée puis on rattache le reste
      const { rows: pairs } = await client.query(
        `SELECT s.id_user_item AS from_id, t.id_user_item AS to_id
         FROM user_items s JOIN user_items t ON t.user_id = s.user_id AND t.item_id = $2
         WHERE s.item_id = $1`,
        [sourceId, targetId],
      );
      for (const { from_id: fromId, to_id: toId } of pairs) {
        await client.query(
          `UPDATE user_items t SET
             rating = COALESCE(t.rating, s.rating),
             review = COALESCE(NULLIF(t.review, ''), s.review),
             started_at = COALESCE(t.started_at, s.started_at),
             finished_at = COALESCE(t.finished_at, s.finished_at),
             is_favorite = t.is_favorite OR s.is_favorite
           FROM user_items s WHERE t.id_user_item = $2 AND s.id_user_item = $1`,
          [fromId, toId],
        );
        await client.query(
          `INSERT INTO user_item_tags (user_item_id, tag_id) SELECT $2, tag_id FROM user_item_tags WHERE user_item_id = $1 ON CONFLICT DO NOTHING`,
          [fromId, toId],
        );
        await client.query(
          `INSERT INTO entry_volumes (user_item_id, number, state, updated_at)
           SELECT $2, number, state, updated_at FROM entry_volumes WHERE user_item_id = $1 ON CONFLICT DO NOTHING`,
          [fromId, toId],
        );
        await client.query(`UPDATE entry_comments SET user_item_id = $2 WHERE user_item_id = $1`, [fromId, toId]);
        await client.query(`UPDATE activities SET user_item_id = $2 WHERE user_item_id = $1`, [fromId, toId]);
        await client.query(`DELETE FROM user_items WHERE id_user_item = $1`, [fromId]);
      }
      await client.query(`UPDATE user_items SET item_id = $2 WHERE item_id = $1`, [sourceId, targetId]);
      await client.query(
        `INSERT INTO list_items (list_id, item_id, position, note, created_at)
         SELECT list_id, $2, position, note, created_at FROM list_items WHERE item_id = $1 ON CONFLICT DO NOTHING`,
        [sourceId, targetId],
      );
      await client.query(
        `INSERT INTO item_entities (item_id, entity_id, role, position)
         SELECT $2, entity_id, role, position FROM item_entities WHERE item_id = $1 ON CONFLICT DO NOTHING`,
        [sourceId, targetId],
      );
      await client.query(`UPDATE user_favorite_entities SET item_id = $2 WHERE item_id = $1`, [sourceId, targetId]);
      await client.query(`UPDATE activities SET item_id = $2 WHERE item_id = $1`, [sourceId, targetId]);
      await client.query(
        `UPDATE recommendations r SET item_id = $2 WHERE item_id = $1
           AND NOT EXISTS (SELECT 1 FROM recommendations x WHERE x.sender_id = r.sender_id AND x.recipient_id = r.recipient_id AND x.item_id = $2)`,
        [sourceId, targetId],
      );
      await client.query(
        `UPDATE import_matches m SET item_id = $2 WHERE item_id = $1`,
        [sourceId, targetId],
      );
      await client.query(`UPDATE search_cache SET item_ids = array_replace(item_ids, $1, $2) WHERE $1 = ANY(item_ids)`, [sourceId, targetId]);
      await client.query(`UPDATE item_similar SET similar_ids = array_replace(similar_ids, $1, $2) WHERE $1 = ANY(similar_ids)`, [sourceId, targetId]);
      // L'identifiant du doublon chez sa source pointe désormais vers la cible
      await client.query(
        `INSERT INTO item_aliases (source, external_id, item_id) VALUES ($1, $2, $3)
         ON CONFLICT (source, external_id) DO UPDATE SET item_id = EXCLUDED.item_id`,
        [source.source, source.externalId, targetId],
      );
      await client.query(`UPDATE item_aliases SET item_id = $2 WHERE item_id = $1`, [sourceId, targetId]);
      await client.query(`DELETE FROM items WHERE id_item = $1`, [sourceId]);
      await logAdminAction(
        adminId,
        "item.merge",
        { targetType: "item", targetId, label: `${source.title} → ${target.title}`, details: { from: `${source.source}:${source.externalId}` } },
        client,
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return target;
  }

  static async deleteItem(adminId, itemId) {
    const item = await ItemRepository.findById(itemId);
    if (!item) throw new AppError("Œuvre introuvable.", 404);
    await db.query(`DELETE FROM items WHERE id_item = $1`, [itemId]);
    await logAdminAction(adminId, "item.delete", { targetType: "item", targetId: itemId, label: item.title });
  }

  // ── Commentaires ──
  static async listComments(query = {}) {
    const current = page(query.page);
    const { rows } = await db.query(
      `
        SELECT c.id_comment, c.body, c.created_at, a.pseudo AS author, a.id_user AS author_id, o.pseudo AS owner,
               i.title, c.user_item_id, COUNT(*) OVER()::int AS total,
               (SELECT COUNT(*)::int FROM reports r WHERE r.target_type = 'comment' AND r.target_id = c.id_comment AND r.status = 'open') AS reports
        FROM entry_comments c
        JOIN users a ON a.id_user = c.author_id
        JOIN user_items ui ON ui.id_user_item = c.user_item_id
        JOIN users o ON o.id_user = ui.user_id
        JOIN items i ON i.id_item = ui.item_id
        ORDER BY c.created_at DESC LIMIT $1 OFFSET $2
      `,
      [PER_PAGE, (current - 1) * PER_PAGE],
    );
    return { ...withTotal(rows), page: current };
  }

  static async deleteComment(adminId, commentId, client = db) {
    const { rows } = await client.query(
      `DELETE FROM entry_comments c USING users a WHERE c.id_comment = $1 AND a.id_user = c.author_id RETURNING a.pseudo, c.body`,
      [commentId],
    );
    if (!rows[0]) throw new AppError("Commentaire introuvable.", 404);
    await logAdminAction(
      adminId,
      "comment.delete",
      { targetType: "comment", targetId: commentId, label: rows[0].pseudo, details: { excerpt: rows[0].body.slice(0, 120) } },
      client,
    );
  }

  // ── Santé des API et des imports ──
  static async getHealth() {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM items) AS items,
        (SELECT COUNT(*)::int FROM items WHERE metadata ? 'detailed') AS detailed,
        (SELECT COUNT(*)::int FROM items WHERE metadata ? 'adminEdited') AS edited,
        (SELECT COUNT(*)::int FROM items WHERE created_at > now() - interval '7 days') AS items_week,
        (SELECT COUNT(*)::int FROM search_cache WHERE fetched_at > now() - interval '7 days') AS search_cache,
        (SELECT COUNT(*)::int FROM item_similar) AS similar_cache,
        (SELECT COUNT(*)::int FROM import_matches) AS import_matches,
        (SELECT COUNT(*)::int FROM item_aliases) AS aliases
    `);
    const { rows: imports } = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM imports WHERE created_at > now() - interval '30 days' GROUP BY status`,
    );
    const { rows: failed } = await db.query(
      `SELECT im.id_import, im.source, im.label, im.error, im.created_at, u.pseudo
       FROM imports im JOIN users u ON u.id_user = im.user_id
       WHERE im.status = 'failed' ORDER BY im.created_at DESC LIMIT 5`,
    );
    const { rows: running } = await db.query(
      `SELECT im.id_import, im.source, im.status, im.total, im.processed, im.created_at, u.pseudo
       FROM imports im JOIN users u ON u.id_user = im.user_id
       WHERE im.status IN ('matching', 'applying') ORDER BY im.created_at`,
    );
    const api = apiSnapshot();
    api.sources = api.sources.map((s) => ({ ...s, waitMs: Math.round(waitTime(s.source)) }));
    const c = api.catalog;
    const searches = c.searchLocalOnly + c.searchCacheHit + c.searchApi;
    return {
      db: rows[0],
      imports: Object.fromEntries(imports.map((r) => [r.status, r.count])),
      failed,
      running,
      api,
      savedRatio: searches ? Math.round(((c.searchLocalOnly + c.searchCacheHit) / searches) * 100) : null,
    };
  }
}

export default AdminService;

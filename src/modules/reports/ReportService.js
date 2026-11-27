"use strict";

import db from "../../config/database.js";
import { AppError } from "../../utils/AppError.js";
import AdminService, { PER_PAGE } from "../admin/AdminService.js";
import { logAdminAction } from "../admin/AuditLog.js";

export const REASONS = {
  spam: "Spam ou publicité",
  harassment: "Harcèlement ou propos haineux",
  inappropriate: "Contenu inapproprié",
  other: "Autre",
};
export const TARGETS = { comment: "un commentaire", user: "un profil" };

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ""));

/**
 * Signalements : un utilisateur signale un commentaire ou un profil, un admin
 * traite la file (supprimer, suspendre, classer). Le contenu signalé est copié
 * au moment du signalement pour rester lisible s'il est modifié ou supprimé.
 */
class ReportService {
  // Ce qu'on montre sur le formulaire et ce qu'on garde dans le signalement
  static async describeTarget(type, id) {
    if (!TARGETS[type] || !isUuid(id)) throw new AppError("Contenu introuvable.", 404);
    if (type === "comment") {
      const { rows } = await db.query(
        `SELECT c.id_comment, c.body, c.author_id, u.pseudo, c.user_item_id
         FROM entry_comments c JOIN users u ON u.id_user = c.author_id WHERE c.id_comment = $1`,
        [id],
      );
      if (!rows[0]) throw new AppError("Ce commentaire n'existe plus.", 404);
      return {
        type,
        id,
        ownerId: rows[0].author_id,
        label: `Commentaire de ${rows[0].pseudo}`,
        excerpt: rows[0].body.slice(0, 300),
        backHref: `/entrees/${rows[0].user_item_id}#commentaires`,
        snapshot: { author: rows[0].pseudo, authorId: rows[0].author_id, body: rows[0].body.slice(0, 2000), entryId: rows[0].user_item_id },
      };
    }
    const { rows } = await db.query(`SELECT id_user, pseudo, biographie FROM users WHERE id_user = $1`, [id]);
    if (!rows[0]) throw new AppError("Ce profil n'existe plus.", 404);
    return {
      type,
      id,
      ownerId: rows[0].id_user,
      label: `Profil de ${rows[0].pseudo}`,
      excerpt: rows[0].biographie ?? "",
      backHref: `/u/${encodeURIComponent(rows[0].pseudo)}`,
      snapshot: { pseudo: rows[0].pseudo, userId: rows[0].id_user, bio: (rows[0].biographie ?? "").slice(0, 1000) },
    };
  }

  static async create(reporterId, { type, id, reason, details }) {
    const target = await ReportService.describeTarget(type, id);
    if (target.ownerId === reporterId) throw new AppError("Tu ne peux pas te signaler toi-même.", 400);
    if (!REASONS[reason]) throw new AppError("Choisis un motif.", 400);
    await db.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (reporter_id, target_type, target_id) WHERE status = 'open' DO NOTHING`,
      [reporterId, type, id, reason, String(details ?? "").trim().slice(0, 500) || null, target.snapshot],
    );
    return target;
  }

  // File de modération : un signalement par ligne, les plus anciens ouverts d'abord
  static async list({ status = "open", page = 1 } = {}) {
    const open = status !== "handled";
    const current = Math.max(1, Number.parseInt(page, 10) || 1);
    const { rows } = await db.query(
      `
        SELECT r.*, rep.pseudo AS reporter, adm.pseudo AS resolver,
               (r.target_type = 'comment' AND EXISTS (SELECT 1 FROM entry_comments c WHERE c.id_comment = r.target_id)) AS comment_exists,
               (SELECT pseudo FROM users WHERE id_user = r.target_id) AS target_pseudo,
               (SELECT suspended_at IS NOT NULL FROM users WHERE id_user = COALESCE((r.snapshot->>'authorId')::uuid, r.target_id)) AS owner_suspended,
               (SELECT COUNT(*)::int FROM reports o WHERE o.target_type = r.target_type AND o.target_id = r.target_id AND o.status = 'open') AS same_target,
               COUNT(*) OVER()::int AS total
        FROM reports r
        LEFT JOIN users rep ON rep.id_user = r.reporter_id
        LEFT JOIN users adm ON adm.id_user = r.resolved_by
        WHERE ($1 AND r.status = 'open') OR (NOT $1 AND r.status <> 'open')
        ORDER BY CASE WHEN $1 THEN r.created_at END ASC, r.resolved_at DESC NULLS LAST
        LIMIT $2 OFFSET $3
      `,
      [open, PER_PAGE, (current - 1) * PER_PAGE],
    );
    return { total: rows[0]?.total ?? 0, rows, page: current, status: open ? "open" : "handled" };
  }

  /**
   * Traite un signalement et tous ceux, encore ouverts, qui visent la même cible.
   * action : delete (supprime le commentaire), suspend (suspend l'auteur ou le profil), dismiss.
   */
  static async resolve(adminId, reportId, action) {
    if (!["delete", "suspend", "dismiss"].includes(action)) throw new AppError("Action inconnue.", 400);
    const { rows } = await db.query(`SELECT * FROM reports WHERE id_report = $1`, [reportId]);
    const report = rows[0];
    if (!report) throw new AppError("Signalement introuvable.", 404);
    if (report.status !== "open") throw new AppError("Ce signalement est déjà traité.", 400);
    const ownerId = report.target_type === "comment" ? report.snapshot.authorId : report.target_id;
    const label = report.snapshot.author ?? report.snapshot.pseudo ?? "inconnu";

    if (action === "delete") {
      if (report.target_type !== "comment") throw new AppError("Seul un commentaire se supprime ici.", 400);
      await AdminService.deleteComment(adminId, report.target_id).catch((error) => {
        if (error.statusCode !== 404) throw error; // déjà supprimé : on clôt quand même
      });
    }
    if (action === "suspend") await AdminService.suspend(adminId, ownerId, `Signalement : ${REASONS[report.reason]}`);

    const resolution = { delete: "deleted", suspend: "suspended", dismiss: "dismissed" }[action];
    await db.query(
      `UPDATE reports SET status = $3, resolved_by = $4, resolved_at = NOW(), resolution = $5
       WHERE status = 'open' AND target_type = $1 AND target_id = $2`,
      [report.target_type, report.target_id, action === "dismiss" ? "dismissed" : "resolved", adminId, resolution],
    );
    await logAdminAction(adminId, action === "dismiss" ? "report.dismiss" : "report.resolve", {
      targetType: report.target_type,
      targetId: report.target_id,
      label,
      details: { reason: report.reason, resolution },
    });
  }
}

export default ReportService;

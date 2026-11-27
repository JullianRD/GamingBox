"use strict";

import db from "../../config/database.js";

/**
 * Journal des actions d'administration (table app_events, catégorie « audit »).
 * Chaque ligne garde l'admin, l'action, la cible et un libellé lisible,
 * même si la cible est supprimée ensuite.
 */

export const AUDIT_LABELS = {
  "user.role": "a changé le rôle de",
  "user.suspend": "a suspendu",
  "user.unsuspend": "a réactivé",
  "user.delete": "a supprimé le compte de",
  "item.edit": "a corrigé la fiche",
  "item.refresh": "a relu depuis la source",
  "item.merge": "a fusionné",
  "item.delete": "a retiré du catalogue",
  "comment.delete": "a supprimé un commentaire de",
  "report.resolve": "a traité un signalement visant",
  "report.dismiss": "a classé sans suite un signalement visant",
};

export const logAdminAction = (adminId, action, { targetType, targetId, label, details = {} } = {}, client = db) =>
  client.query(
    `INSERT INTO app_events (user_id, event_category, event_type, severity, message, metadata)
     VALUES ($1, 'audit', $2, 'info', $3, $4)`,
    [adminId, action, label ?? null, { targetType, targetId, label, ...details }],
  );

export const findAdminActions = async ({ page = 1, perPage = 40, action = null } = {}) => {
  const { rows } = await db.query(
    `
      SELECT e.id_event, e.event_type, e.message, e.metadata, e.created_at, u.pseudo AS admin_pseudo,
             COUNT(*) OVER()::int AS total
      FROM app_events e LEFT JOIN users u ON u.id_user = e.user_id
      WHERE e.event_category = 'audit' AND ($3::text IS NULL OR e.event_type LIKE $3 || '%')
      ORDER BY e.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [perPage, (page - 1) * perPage, action],
  );
  return {
    total: rows[0]?.total ?? 0,
    actions: rows.map((row) => ({
      id: row.id_event,
      action: row.event_type,
      verb: AUDIT_LABELS[row.event_type] ?? row.event_type,
      label: row.message,
      details: row.metadata ?? {},
      admin: row.admin_pseudo ?? "compte supprimé",
      createdAt: row.created_at,
    })),
  };
};

"use strict";

import { Router } from "express";
import AdminService, { ROLES } from "./AdminService.js";
import ReportService, { REASONS } from "../reports/ReportService.js";
import { findAdminActions, AUDIT_LABELS } from "./AuditLog.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

// Espace d'administration, réservé aux administrateurs
const router = Router();
router.use("/admin", requireAuth, requireAdmin);

const TABS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/reports", label: "Signalements" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/items", label: "Catalogue" },
  { href: "/admin/comments", label: "Commentaires" },
  { href: "/admin/health", label: "Santé des API" },
  { href: "/admin/journal", label: "Journal" },
];

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const render = (res, view, title, locals = {}) =>
  res.render(`pages/admin/${view}`, { title: `${title} - Admin Cocon`, adminTabs: TABS, ...locals });

// Action : message flash puis retour ; une erreur métier (400) s'affiche au lieu de planter
const act = (handler, fallback) =>
  wrap(async (req, res) => {
    const back = () => (typeof fallback === "function" ? fallback(req) : fallback);
    try {
      const message = await handler(req);
      req.flash("success", message);
      const asked = req.body?.back;
      res.redirect(typeof asked === "string" && /^\/admin(\/|\?|$)/.test(asked) ? asked : back());
    } catch (error) {
      if (error.statusCode !== 400 && error.statusCode !== 404) throw error;
      req.flash("error", error.message);
      res.redirect(back());
    }
  });

const ids = requireUuidParams("id", "targetId");
const post = [ids, doubleCsrfProtection];

// ── Lecture ──
router.get("/admin", wrap(async (req, res) => render(res, "index", "Vue d'ensemble", await AdminService.getDashboard())));
router.get("/admin/users", wrap(async (req, res) => render(res, "users", "Utilisateurs", { list: await AdminService.listUsers(req.query), roles: ROLES })));
router.get("/admin/users/:id", ids, wrap(async (req, res) => render(res, "user", "Utilisateur", { ...(await AdminService.getUser(req.params.id)), roles: ROLES })));
router.get("/admin/items", wrap(async (req, res) => render(res, "items", "Catalogue", { list: await AdminService.listItems(req.query) })));
router.get("/admin/items/:id", ids, wrap(async (req, res) => render(res, "item", "Fiche", await AdminService.getItem(req.params.id))));
router.get("/admin/comments", wrap(async (req, res) => render(res, "comments", "Commentaires", { list: await AdminService.listComments(req.query) })));
router.get("/admin/reports", wrap(async (req, res) => render(res, "reports", "Signalements", { list: await ReportService.list(req.query), reasons: REASONS })));
router.get("/admin/health", wrap(async (req, res) => render(res, "health", "Santé des API", await AdminService.getHealth())));
router.get(
  "/admin/journal",
  wrap(async (req, res) => {
    const pageNumber = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const action = Object.keys(AUDIT_LABELS).some((key) => key.startsWith(req.query.action ?? "-")) ? req.query.action : null;
    render(res, "journal", "Journal", { journal: await findAdminActions({ page: pageNumber, action }), page: pageNumber, action });
  }),
);

// ── Utilisateurs ──
const userPage = (req) => `/admin/users/${req.params.id}`;
router.post("/admin/users/:id/role", ...post, act(async (req) => {
  const user = await AdminService.setRole(req.session.userId, req.params.id, req.body.role);
  return `${user.pseudo} est maintenant ${user.role_name === "admin" ? "administrateur" : "utilisateur"}.`;
}, userPage));
router.post("/admin/users/:id/suspend", ...post, act(async (req) => {
  await AdminService.suspend(req.session.userId, req.params.id, req.body.reason);
  return "Compte suspendu : ses sessions sont fermées.";
}, userPage));
router.post("/admin/users/:id/unsuspend", ...post, act(async (req) => {
  await AdminService.unsuspend(req.session.userId, req.params.id);
  return "Compte réactivé.";
}, userPage));
router.post("/admin/users/:id/delete", ...post, act(async (req) => {
  await AdminService.deleteUser(req.session.userId, req.params.id);
  return "Utilisateur supprimé.";
}, "/admin/users"));

// ── Catalogue ──
const itemPage = (req) => `/admin/items/${req.params.id}`;
router.post("/admin/items/:id/edit", ...post, act(async (req) => {
  await AdminService.editItem(req.session.userId, req.params.id, req.body);
  return "Fiche corrigée. Les mises à jour automatiques ne toucheront plus à ces champs.";
}, itemPage));
router.post("/admin/items/:id/refresh", ...post, act(async (req) => {
  await AdminService.refreshItem(req.session.userId, req.params.id);
  return "Fiche relue depuis sa source.";
}, itemPage));
router.post("/admin/items/:id/merge/:targetId", ...post, act(async (req) => {
  const target = await AdminService.mergeItems(req.session.userId, req.params.id, req.params.targetId);
  req.params.id = target.id; // retour sur la fiche gardée
  return `Doublon fusionné dans « ${target.title} ».`;
}, itemPage));
router.post("/admin/items/:id/delete", ...post, act(async (req) => {
  await AdminService.deleteItem(req.session.userId, req.params.id);
  return "Œuvre retirée du catalogue.";
}, "/admin/items"));

// ── Commentaires et signalements ──
router.post("/admin/comments/:id/delete", ...post, act(async (req) => {
  await AdminService.deleteComment(req.session.userId, req.params.id);
  return "Commentaire supprimé.";
}, "/admin/comments"));
router.post("/admin/reports/:id/:action", ...post, act(async (req) => {
  await ReportService.resolve(req.session.userId, req.params.id, req.params.action);
  return { delete: "Commentaire supprimé, signalement traité.", suspend: "Compte suspendu, signalement traité.", dismiss: "Signalement classé sans suite." }[req.params.action];
}, "/admin/reports"));

export default router;

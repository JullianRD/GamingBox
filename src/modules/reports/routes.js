"use strict";

import { Router } from "express";
import ReportService, { REASONS, TARGETS } from "./ReportService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";

const router = Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Formulaire de signalement d'un commentaire ou d'un profil
router.get(
  "/signaler",
  requireAuth,
  wrap(async (req, res) => {
    const target = await ReportService.describeTarget(req.query.type, req.query.id);
    res.render("pages/reports/new", { title: "Signaler - Cocon", target, reasons: REASONS, targetLabel: TARGETS[target.type] });
  }),
);

router.post(
  "/signaler",
  requireAuth,
  doubleCsrfProtection,
  wrap(async (req, res) => {
    try {
      const target = await ReportService.create(req.session.userId, req.body);
      req.flash("success", "Merci, ton signalement a été transmis. L'équipe va regarder.");
      res.redirect(target.backHref);
    } catch (error) {
      if (error.statusCode !== 400) throw error;
      req.flash("error", error.message);
      res.redirect(`/signaler?type=${encodeURIComponent(req.body.type)}&id=${encodeURIComponent(req.body.id)}`);
    }
  }),
);

export default router;

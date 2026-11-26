"use strict";

import { Router } from "express";
import multer from "multer";
import ImportService from "./ImportService.js";
import ExportService from "./ExportService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";
import { AppError } from "../../utils/AppError.js";

const router = Router();
router.use(["/imports", "/exports"], requireAuth);

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
const RUNNING = ["matching", "applying"];

// Le fichier passe avant la vérification CSRF : le jeton est dans le formulaire multipart
const receiveFile = (req, res, next) =>
  upload.single("file")(req, res, (error) => {
    if (error) return next(new AppError(error.code === "LIMIT_FILE_SIZE" ? "Fichier trop lourd (25 Mo maximum)." : "Envoi du fichier impossible.", 400));
    next();
  });

router.get(
  "/imports",
  wrap(async (req, res) => {
    const imports = await ImportService.getImports(req.session.userId);
    res.render("pages/imports/index", { title: "Imports et exports - Cocon", sources: ImportService.sources(), imports });
  }),
);

router.post(
  "/imports/:source",
  receiveFile,
  doubleCsrfProtection,
  wrap(async (req, res) => {
    try {
      const options = Object.fromEntries(Object.entries(req.body.options ?? {}).map(([k, v]) => [k, String(v)]));
      const created = await ImportService.create(req.session.userId, req.params.source, {
        buffer: req.file?.buffer,
        filename: req.file?.originalname ?? "",
        username: req.body.username,
        options,
      });
      res.redirect(`/imports/${created.id}`);
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) throw error;
      req.flash("error", error.message);
      res.redirect(`/imports#${req.params.source}`);
    }
  }),
);

const imp = Router({ mergeParams: true });
router.use("/imports/:importId", requireUuidParams("importId"), imp);

imp.get(
  "/",
  wrap(async (req, res) => {
    const review = await ImportService.getReview(req.params.importId, req.session.userId);
    res.render("pages/imports/show", { title: `Import ${review.current.sourceLabel} - Cocon`, ...review });
  }),
);

// Suivi de la progression (htmx) : la page se recharge quand l'étape change
imp.get(
  "/progression",
  wrap(async (req, res) => {
    const current = await ImportService.getImport(req.params.importId, req.session.userId);
    if (!RUNNING.includes(current.status) || req.query.statut !== current.status) {
      res.set("HX-Refresh", "true");
      return res.status(204).end();
    }
    res.render("partials/imports/progress", { layout: false, current });
  }),
);

const rowAction = (action) =>
  wrap(async (req, res) => {
    const { importId, rowId } = req.params;
    const row = await action(importId, req.session.userId, rowId, req.body);
    if (req.get("HX-Request")) return res.render("partials/imports/row", { layout: false, row, importId });
    res.redirect(`/imports/${importId}`);
  });

imp.post("/lignes/:rowId/recherche", requireUuidParams("rowId"), doubleCsrfProtection,
  rowAction((id, user, row, body) => ImportService.searchForRow(id, user, row, body.q)));
imp.post("/lignes/:rowId/choisir", requireUuidParams("rowId"), doubleCsrfProtection,
  rowAction((id, user, row, body) => ImportService.chooseCandidate(id, user, row, body.index)));
imp.post("/lignes/:rowId/ecarter", requireUuidParams("rowId"), doubleCsrfProtection,
  rowAction((id, user, row) => ImportService.toggleSkip(id, user, row)));

imp.post(
  "/appliquer",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    await ImportService.apply(req.params.importId, req.session.userId);
    res.redirect(`/imports/${req.params.importId}`);
  }),
);

imp.post(
  "/supprimer",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    await ImportService.remove(req.params.importId, req.session.userId);
    req.flash("success", "Import supprimé. Les œuvres déjà ajoutées restent dans ta bibliothèque.");
    res.redirect("/imports");
  }),
);

// Exports
router.get(
  "/exports/cocon.csv",
  wrap(async (req, res) => {
    res.attachment("cocon-bibliotheque.csv").type("text/csv; charset=utf-8");
    res.send(await ExportService.coconExport(req.session.userId));
  }),
);

router.get(
  "/exports/letterboxd.zip",
  wrap(async (req, res) => {
    res.attachment("cocon-letterboxd.zip").type("application/zip");
    res.send(Buffer.from(await ExportService.letterboxdExport(req.session.userId)));
  }),
);

export default router;

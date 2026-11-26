"use strict";

import ImportService from "../services/ImportService.js";
import { AppError } from "../utils/AppError.js";

class ImportController {
  show(req, res) {
    return res.render("pages/import/index", {
      title: "Importer ma bibliothèque - GamingBox",
      report: null,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }

  async handle(req, res) {
    if (!req.file) throw AppError.badRequest("Choisis un fichier CSV à importer.");

    const report = await ImportService.importCsv(
      req.session.userId,
      req.file.buffer.toString("utf8"),
    );

    return res.render("pages/import/index", {
      title: "Importer ma bibliothèque - GamingBox",
      report,
      user: res.locals.currentUser || null,
      flash: { success: `${report.created} jeu(x) importé(s).` },
    });
  }
}

export default new ImportController();

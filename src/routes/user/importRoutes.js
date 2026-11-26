"use strict";

import { Router } from "express";
import multer from "multer";
import ImportController from "../../controller/ImportController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { csrfAfterMultipart } from "../../config/security.js";
import { AppError } from "../../utils/AppError.js";

const router = Router();

// CSV en mémoire, 512 Ko maximum, extension et type vérifiés
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const okType = /csv|text\/plain|excel/.test(file.mimetype) || /\.csv$/i.test(file.originalname);
    cb(okType ? null : AppError.badRequest("Format invalide : fichier .csv attendu."), okType);
  },
});

router.use("/import", requireAuth);
router.get("/import", ImportController.show);
router.post("/import", uploadCsv.single("file"), ...csrfAfterMultipart, ImportController.handle);

export default router;

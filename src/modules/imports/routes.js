"use strict";

import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";

const router = Router();

// Page des imports : les sources arrivent aux étapes 7 (Letterboxd) et 8 (Steam)
router.get("/imports", requireAuth, (req, res) => {
  res.render("pages/imports/index", { title: "Imports - Cocon" });
});

export default router;

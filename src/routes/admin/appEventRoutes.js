"use strict";

import { Router } from "express";
import AppEventController from "../../controller/AppEventController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";

const router = Router();

// API JSON réservée aux administrateurs
router.use("/admin/events", requireAuth, requireAdmin, (req, _res, next) => {
  req.forceJson = true;
  next();
});

router.get("/admin/events/stats", AppEventController.stats);
router.get("/admin/events", AppEventController.index);
router.get("/admin/events/:id", AppEventController.show);
router.delete("/admin/events/:id", AppEventController.destroy);
router.post("/admin/events/cleanup", AppEventController.cleanup);

export default router;

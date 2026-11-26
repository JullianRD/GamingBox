"use strict";

import { Router } from "express";
import StatsController from "../../controller/StatsController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/stats", requireAuth, StatsController.index);

export default router;

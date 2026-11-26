"use strict";

import { Router } from "express";
import LibraryController from "./LibraryController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/", LibraryController.home);
router.get(["/jeux", "/films"], requireAuth, LibraryController.section);

export default router;

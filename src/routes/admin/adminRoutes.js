"use strict";

import { Router } from "express";
import AdminController from "../../controller/AdminController.js";
import { requireAuth, requireAdmin } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

// Espace d'administration, réservé aux administrateurs
const router = Router();
router.use("/admin", requireAuth, requireAdmin);

router.get("/admin", AdminController.index);
router.get("/admin/users", AdminController.users);
router.get("/admin/items", AdminController.items);
router.get("/admin/comments", AdminController.comments);

const guard = [requireUuidParams("id"), doubleCsrfProtection];
router.post("/admin/users/:id/delete", ...guard, AdminController.destroyUser);
router.post("/admin/items/:id/delete", ...guard, AdminController.destroyItem);
router.post("/admin/comments/:id/delete", ...guard, AdminController.destroyComment);

export default router;

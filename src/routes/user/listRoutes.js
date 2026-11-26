"use strict";

import { Router } from "express";
import ListController from "../../controller/ListController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas } from "../../validators/listValidator.js";

const router = Router();

router.use("/lists", requireAuth);

router.get("/lists", ListController.index);
router.get("/lists/new", ListController.new);
router.post("/lists", validate(schemas.create, { fallback: "/lists/new" }), ListController.store);

router.get("/lists/:slug", ListController.show);
router.get("/lists/:slug/edit", ListController.edit);
router.post("/lists/:slug", validate(schemas.update), ListController.update);
router.post("/lists/:slug/delete", ListController.destroy);

router.post("/lists/:slug/items", validate(schemas.addItem), ListController.addItem);
router.post("/lists/:slug/items/:gameId/delete", ListController.removeItem);

export default router;

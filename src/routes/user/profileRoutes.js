"use strict";

import { Router } from "express";
import ProfileController from "../../controller/ProfileController.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { csrfAfterMultipart } from "../../config/security.js";
import uploadAvatar from "../../middlewares/uploadAvatar.js";
import { validate } from "../../middlewares/validationMiddleware.js";
import { schemas as userSchemas } from "../../validators/userValidator.js";

const router = Router();

router.use("/profile", requireAuth);

router.get("/profile", ProfileController.index);
router.get("/profile/edit", ProfileController.edit);

// multer (corps multipart) -> CSRF -> validation -> contrôleur
router.post(
  "/profile/edit",
  uploadAvatar.single("avatar"),
  ...csrfAfterMultipart,
  validate(userSchemas.updateProfile, { fallback: "/profile/edit" }),
  ProfileController.update,
);

router.post("/profile/delete", ProfileController.destroy);
router.get("/profile/export", ProfileController.export);

export default router;

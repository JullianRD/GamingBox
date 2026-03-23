"use strict";

import multer from "multer";

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Format de fichier invalide. Utilise JPG, PNG ou WEBP."));
  }

  cb(null, true);
};

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Mo
  },
});

export default uploadAvatar;
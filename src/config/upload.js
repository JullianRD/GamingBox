"use strict";
import multer from "multer";
import path from "path";
import crypto from "crypto";

/**
 * Configuration de l'upload de fichiers (images)
 * Stockage local pour l'instant
 * @module config/upload
 * @see https://medium.com/@julien.maffar/impl%C3%A9mentation-de-multer-dans-une-api-node-js-e358dd513e64
 */

// Définition du stockage : où et comment nommer les fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Le dossier doit exister !
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    // Génère un nom unique: uuid + extension (ex: a1b2...c44.jpg)
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Filtre: Accepter uniquement les images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Format de fichier non supporté, Images uniquement.", false));
  }
};

// Export du middleware configuré
export const uploadConfig = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite à 5MB
  },
});


// Permettre à ton backend d’accepter des fichiers uploadés par les utilisateurs (ici des images), avec sécurité et noms uniques.


// ✅ Stockage sécurisé avec noms uniques
// ✅ Filtrage strict des types MIME autorisés
// ✅ Limite de taille
// ✅ Facile à intégrer dans Express

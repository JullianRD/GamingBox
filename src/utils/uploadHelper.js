"use strict";
import fs from "fs/promises";
import path from "path";
import { logger } from "../config/logger.js";

/**
 * Gestionnaire utilitaire pour les fichiers uploadés.
 * @module utils/uploadHelper
 */

/**
 * Supprime un fichier du dossier public (ex: suppression d'un item).
 * @param {string} relativePath - Le chemin stocké en DB (ex: '/uploads/image123.jpg')
 */
export const deleteFile = async (relativePath) => {
  // Sécurité : ne jamais supprimer si le chemin est vide ou externe (http)
  if (!relativePath || relativePath.startsWith("http")) return;

  try {
    // Construction du chemin absolu système
    // process.cwd() renvoie la racine du projet
    const fullPath = path.join(process.cwd(), "public", relativePath);

    await fs.unlink(fullPath);
    logger.info({ file: relativePath }, "Fichier supprimé avec succès");
  } catch (error) {
    // On ignore l'erreur 'ENOENT' (Fichier non trouvé) car le résultat est le même (fichier absent)
    if (error.code !== "ENOENT") {
      logger.error(
        { err: error, file: relativePath },
        "Erreur lors de la suppression du fichier",
      );
    }
  }
};

/**
 * Prépare le chemin pour la base de données après upload Multer
 * @param {Object} file - L'objet file généré par Multer
 * @returns {string|null} Le chemin relatif web (ex: /uploads/abc.jpg) ou null
 */
export const handleUploadPath = (file) => {
  if (!file) return null;
  return `/uploads/${file.filename}`;
};

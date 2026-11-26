"use strict";
/**
 * Import d'une bibliothèque depuis un CSV (export BacklogGD, HowLongToBeat, tableur...).
 * Colonnes reconnues (insensibles à la casse) :
 *   titre|title|name|jeu  (obligatoire)
 *   statut|status         (terminé|finished|completed, en cours|playing, wishlist, abandonné|dropped)
 *   note|rating|score     (0 à 10)
 *   plateforme|platform   (PC, console...)
 */
import db from "../config/database.js";
import ReviewService from "./ReviewService.js";
import GameService from "./GameService.js";
import { parseCsv } from "../utils/csv.js";
import { AppError } from "../utils/AppError.js";
import logger from "../config/logger.js";

export const MAX_IMPORT_ROWS = 200;

const pick = (row, keys) => keys.map((k) => row[k]).find((v) => v !== undefined && v !== "") ?? "";

export function normalizeStatus(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (/(termin|finish|complet|beaten|fini)/.test(v)) return "Terminé";
  if (/(wish|souhait|envie)/.test(v)) return "Whislist";
  if (/(drop|abandon)/.test(v)) return "Dropped";
  return "En cour";
}

export function normalizePlatform(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (/(^pc$|windows|steam|epic|mac|linux)/.test(v)) return "PC";
  if (/(ps\d|playstation|xbox|switch|nintendo|console|wii|3ds)/.test(v)) return "Console de jeu";
  return "Autre";
}

export function normalizeRating(value) {
  const n = Number(String(value || "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 10);
}

class ImportService {
  /**
   * Trouve le jeu correspondant à un titre : base locale d'abord, IGDB ensuite.
   * `searchIgdb` est injectable (tests, indisponibilité d'IGDB).
   */
  static async resolveGame(title, { searchIgdb = (q) => GameService.searchIgdbGames(q) } = {}) {
    const { rows } = await db.query(
      "SELECT id_game FROM games WHERE LOWER(game_title) = LOWER($1) LIMIT 1",
      [title],
    );
    if (rows[0]) return rows[0].id_game;

    const results = await searchIgdb(title);
    const best =
      results.find((g) => g.gameTitle.toLowerCase() === title.toLowerCase()) || results[0];
    if (!best) return null;

    const { game } = await GameService.getOrCreateByIgdbId(best.igdbId);
    return game.id;
  }

  static async importCsv(userId, csvText, options = {}) {
    const rows = parseCsv(csvText);
    if (!rows.length)
      throw AppError.badRequest("Le fichier CSV est vide ou sans ligne de données.");
    if (rows.length > MAX_IMPORT_ROWS) {
      throw AppError.badRequest(
        `Import limité à ${MAX_IMPORT_ROWS} lignes (${rows.length} trouvées).`,
      );
    }

    const report = { total: rows.length, created: 0, skipped: [], failed: [] };

    for (const [index, row] of rows.entries()) {
      const line = index + 2; // ligne 1 = en-têtes
      const title = pick(row, ["titre", "title", "name", "jeu", "game"]);

      if (!title) {
        report.failed.push({ line, reason: "Titre manquant" });
        continue;
      }

      try {
        const gameId = await this.resolveGame(title, options);
        if (!gameId) {
          report.failed.push({ line, title, reason: "Jeu introuvable" });
          continue;
        }

        await ReviewService.create(userId, gameId, {
          reviewTitle: title.slice(0, 100),
          reviewRate: normalizeRating(pick(row, ["note", "rating", "score"])),
          progressionStatus: normalizeStatus(pick(row, ["statut", "status", "état", "etat"])),
          gamePlatforme: normalizePlatform(pick(row, ["plateforme", "platform"])),
          avisReview: pick(row, ["avis", "review", "notes", "commentaire"]).slice(0, 1000),
          reviewLike: false,
          reviewPlatine: false,
          isPublic: false,
        });
        report.created += 1;
      } catch (error) {
        if (error?.isOperational && error.statusCode === 409) {
          report.skipped.push({ line, title, reason: "Déjà dans ta bibliothèque" });
        } else if (error?.isOperational) {
          report.failed.push({ line, title, reason: error.message });
        } else {
          logger.error({ err: error, line }, "Import CSV : erreur inattendue");
          report.failed.push({ line, title, reason: "Erreur technique" });
        }
      }
    }

    return report;
  }
}

export default ImportService;

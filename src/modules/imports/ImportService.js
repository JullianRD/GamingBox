"use strict";

import ImportRepository from "./ImportRepository.js";
import { getSource, allSources } from "./sources/index.js";
import { pickMatch } from "./matching.js";
import CatalogService from "../catalog/CatalogService.js";
import ItemRepository from "../catalog/ItemRepository.js";
import UserItemRepository from "../library/UserItemRepository.js";
import { getProvider, providerForType } from "../catalog/providers/index.js";
import { mapLimit } from "../catalog/http.js";
import { AppError } from "../../utils/AppError.js";
import { STATUSES } from "../../utils/itemTypes.js";
import { logger } from "../../config/logger.js";

/**
 * Imports en trois temps :
 * 1. lecture du fichier ou du compte -> lignes normalisées (sources/*)
 * 2. recherche de chaque œuvre dans le catalogue (en tâche de fond)
 * 3. revue par l'utilisateur puis application à sa bibliothèque
 *
 * Le travail tourne dans le processus de l'app ; un import interrompu par un
 * redémarrage reprend au lancement suivant (resume).
 */

const MAX_ROWS = 5000;
const CHUNK = 40;
const REVIEW_STATES = ["ambiguous", "unmatched"];
const running = new Set();

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) ? value : null;

// Une ligne -> une œuvre du catalogue, ou des propositions
export const matchRow = async (data, preset = null) => {
  if (data.item) return { state: "matched", match: data.item, candidates: [] };
  if (preset) return { state: "matched", match: preset, candidates: [] };

  if (data.ids?.tmdb) {
    const tmdb = getProvider("tmdb");
    const fetched = tmdb.configured() ? await tmdb.fetchItem(data.ids.tmdb).catch(() => null) : null;
    return {
      state: "matched",
      match: fetched ?? {
        type: data.type,
        source: "tmdb",
        externalId: data.ids.tmdb,
        title: data.title,
        releaseDate: data.year ? `${data.year}-01-01` : null,
        coverUrl: null,
        genres: [],
        metadata: {},
      },
      candidates: [],
    };
  }

  if (data.type === "book" && data.ids?.isbn) {
    const found = await getProvider("openlibrary").findByIsbn(data.ids.isbn).catch(() => null);
    if (found) return { state: "matched", match: found, candidates: [] };
  }

  const provider = providerForType(data.type);
  if (!provider?.configured()) return { state: "unmatched", match: null, candidates: [] };
  const options = { type: data.type, year: data.year, author: data.creator, artist: data.creator };
  const candidates = await (provider.match ? provider.match(data.title, options) : provider.search(data.title, options));
  return pickMatch(data, candidates.filter((item) => item.type === data.type));
};

class ImportService {
  static sources() {
    return allSources().map((s) => ({
      key: s.key,
      label: s.label,
      types: s.types,
      input: s.input,
      accept: s.accept,
      hint: s.hint,
      placeholder: s.placeholder,
      options: s.options ?? [],
      configured: s.configured(),
    }));
  }

  static async create(userId, sourceKey, input) {
    const source = getSource(sourceKey);
    if (!source) throw new AppError("Source d'import inconnue.", 404);
    if (!source.configured()) throw new AppError(`L'import ${source.label} n'est pas configuré sur ce serveur.`, 400);
    if (source.input === "file" && !input.buffer) throw new AppError("Choisis un fichier à importer.", 400);

    const { label, rows } = await source.read(input);
    if (!rows.length) throw new AppError("Rien à importer dans ce fichier.", 400);
    if (rows.length > MAX_ROWS) throw new AppError(`Un import est limité à ${MAX_ROWS} œuvres.`, 400);

    const created = await ImportRepository.create(userId, { source: source.key, label, options: input.options ?? {}, rows });
    this.start(created.id);
    return created;
  }

  // Lance le traitement en tâche de fond (une seule fois par import)
  static start(importId) {
    if (running.has(importId)) return null;
    running.add(importId);
    const task = this.run(importId)
      .catch(async (error) => {
        logger.error({ err: error, importId }, "Import en échec");
        await ImportRepository.setStatus(importId, "failed", { error: error.message?.slice(0, 500) }).catch(() => {});
      })
      .finally(() => running.delete(importId));
    return task;
  }

  static async resume() {
    const ids = await ImportRepository.findRunning();
    for (const id of ids) this.start(id);
    if (ids.length) logger.info({ count: ids.length }, "Imports repris");
  }

  static async run(importId) {
    const current = await ImportRepository.findById(importId);
    if (current?.status === "matching") await this.matchAll(current);
    else if (current?.status === "applying") await this.applyAll(current);
  }

  static async matchAll(current) {
    const source = getSource(current.source);
    let processed = current.total - (await ImportRepository.countRows(current.id, ["pending"]));
    for (;;) {
      const rows = await ImportRepository.findRowsByState(current.id, ["pending"], { limit: CHUNK });
      if (!rows.length) break;
      const presets = source?.matchBatch
        ? await source.matchBatch(rows.map((r) => r.data)).catch((error) => {
            logger.warn({ err: error }, "Correspondance groupée indisponible");
            return null;
          })
        : null;
      await mapLimit(rows, 3, async (row, index) => {
        const result = await matchRow(row.data, presets?.[index]).catch((error) => {
          logger.warn({ err: error, row: row.id }, "Correspondance impossible");
          return { state: "unmatched", match: null, candidates: [] };
        });
        await ImportRepository.updateRow(row.id, result);
      });
      processed += rows.length;
      await ImportRepository.setProcessed(current.id, processed);
    }
    await ImportRepository.setStatus(current.id, "review");
  }

  static async applyAll(current) {
    let processed = 0;
    for (;;) {
      const rows = await ImportRepository.findRowsByState(current.id, ["matched"], { limit: CHUNK });
      if (!rows.length) break;
      for (const row of rows) {
        await this.applyRow(current, row);
        await ImportRepository.setRowState(row.id, "applied");
      }
      processed += rows.length;
      await ImportRepository.setProcessed(current.id, processed);
    }
    await ImportRepository.setStatus(current.id, "done");
  }

  static async applyRow(current, row) {
    const data = row.data;
    const item = await ItemRepository.upsert(row.match);
    const metadata = { importedFrom: current.source };
    if (data.playtime) metadata.playtimeMinutes = data.playtime;
    if (data.playcount) metadata.playcount = data.playcount;
    const entryId = await UserItemRepository.importEntry(current.userId, item.id, {
      status: STATUSES.includes(data.status) ? data.status : "planned",
      rating: Number.isInteger(data.rating) && data.rating >= 1 && data.rating <= 10 ? data.rating : null,
      review: data.review ? String(data.review).slice(0, 5000) : null,
      favorite: data.favorite,
      startedAt: isDate(data.startedAt),
      finishedAt: isDate(data.finishedAt),
      metadata,
    });
    for (const tag of (data.tags ?? []).slice(0, 10)) {
      await UserItemRepository.addTag(entryId, current.userId, String(tag).slice(0, 50));
    }
  }

  // --- Pages ---

  static getImports(userId) {
    return ImportRepository.findAllByUser(userId);
  }

  static async getImport(importId, userId) {
    const found = await ImportRepository.findForUser(importId, userId);
    if (!found) throw new AppError("Import introuvable.", 404);
    return { ...found, sourceLabel: getSource(found.source)?.label ?? found.source };
  }

  static async getReview(importId, userId) {
    const current = await this.getImport(importId, userId);
    const [toReview, matched, skipped] = await Promise.all([
      ImportRepository.findRowsByState(importId, REVIEW_STATES, { limit: 100 }),
      ImportRepository.findRowsByState(importId, ["matched"], { limit: 300 }),
      ImportRepository.findRowsByState(importId, ["skipped"], { limit: 100 }),
    ]);
    return { current, toReview, matched, skipped };
  }

  static async getRow(importId, userId, rowId) {
    const current = await this.getImport(importId, userId);
    if (current.status !== "review") throw new AppError("Cet import n'est plus modifiable.", 409);
    const row = await ImportRepository.findRow(rowId, importId);
    if (!row) throw new AppError("Ligne introuvable.", 404);
    return { current, row };
  }

  // Recherche manuelle : les résultats deviennent les propositions de la ligne
  static async searchForRow(importId, userId, rowId, query) {
    const { row } = await this.getRow(importId, userId, rowId);
    const q = String(query ?? "").trim().slice(0, 100);
    if (q.length < 2) return row;
    const { results } = await CatalogService.search(q, { type: row.data.type });
    return ImportRepository.updateRow(row.id, {
      state: results.length ? "ambiguous" : "unmatched",
      candidates: results.filter((item) => item.type === row.data.type).slice(0, 8),
    });
  }

  static async chooseCandidate(importId, userId, rowId, index) {
    const { row } = await this.getRow(importId, userId, rowId);
    const choice = row.candidates[Number(index)];
    if (!choice) throw new AppError("Proposition introuvable.", 400);
    return ImportRepository.updateRow(row.id, { state: "matched", match: choice, candidates: [] });
  }

  // Écarter une ligne, ou la remettre en jeu
  static async toggleSkip(importId, userId, rowId) {
    const { row } = await this.getRow(importId, userId, rowId);
    const state =
      row.state !== "skipped" ? "skipped" : row.match ? "matched" : row.candidates.length ? "ambiguous" : "unmatched";
    return ImportRepository.updateRow(row.id, { state, match: row.match, candidates: row.candidates });
  }

  static async apply(importId, userId) {
    const current = await this.getImport(importId, userId);
    if (current.status !== "review") throw new AppError("Cet import est déjà appliqué.", 409);
    await ImportRepository.setStatus(importId, "applying");
    return this.start(importId);
  }

  static async remove(importId, userId) {
    const current = await this.getImport(importId, userId);
    if (["matching", "applying"].includes(current.status)) throw new AppError("Attends la fin du traitement.", 409);
    return ImportRepository.delete(importId, userId);
  }
}

export default ImportService;

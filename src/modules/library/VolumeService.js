"use strict";

import db from "../../config/database.js";
import LibraryService from "./LibraryService.js";
import { AppError } from "../../utils/AppError.js";

// Types dont on suit les tomes
export const VOLUME_TYPES = new Set(["manga"]);
export const MAX_VOLUMES = 500;

// Un clic fait tourner l'état : rien, possédé, lu, rien
const NEXT_STATE = { none: "owned", owned: "read", read: "none" };

const parseNumber = (value, max) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new AppError(`Indique un nombre entre 1 et ${max}.`, 400);
  return n;
};

/**
 * Collection de tomes d'une entrée manga : possédés, lus, et nombre total.
 */
class VolumeService {
  static async #entry(entryId, userId) {
    const entry = await LibraryService.getEntry(entryId, userId);
    if (!VOLUME_TYPES.has(entry.type)) throw new AppError("Cette œuvre n'a pas de tomes.", 400);
    return entry;
  }

  static async get(entryId, userId) {
    const entry = await VolumeService.#entry(entryId, userId);
    const [{ rows: states }, { rows: totals }] = await Promise.all([
      db.query("SELECT number, state FROM entry_volumes WHERE user_item_id = $1 ORDER BY number", [entry.id]),
      db.query("SELECT volumes_total FROM user_items WHERE id_user_item = $1", [entry.id]),
    ]);
    const byNumber = new Map(states.map((row) => [row.number, row.state]));
    const highest = states.length ? states[states.length - 1].number : 0;
    const catalogTotal = Number(entry.itemMetadata.volumes) || null;
    const customTotal = totals[0]?.volumes_total ?? null;
    const total = Math.max(customTotal ?? catalogTotal ?? 0, highest);

    return {
      entry,
      total,
      known: Boolean(customTotal ?? catalogTotal),
      custom: customTotal !== null,
      volumes: Array.from({ length: total }, (_, i) => ({ number: i + 1, state: byNumber.get(i + 1) ?? "none" })),
      owned: states.length,
      read: states.filter((row) => row.state === "read").length,
    };
  }

  // Fait passer un tome à l'état suivant
  static async cycle(entryId, userId, number) {
    const { entry, total, volumes } = await VolumeService.get(entryId, userId);
    const n = parseNumber(number, Math.max(total, 1));
    const next = NEXT_STATE[volumes[n - 1]?.state ?? "none"];
    if (next === "none") {
      await db.query("DELETE FROM entry_volumes WHERE user_item_id = $1 AND number = $2", [entry.id, n]);
    } else {
      await db.query(
        `INSERT INTO entry_volumes (user_item_id, number, state) VALUES ($1, $2, $3)
         ON CONFLICT (user_item_id, number) DO UPDATE SET state = EXCLUDED.state, updated_at = CURRENT_TIMESTAMP`,
        [entry.id, n, next],
      );
    }
    return VolumeService.get(entryId, userId);
  }

  // Fixe le nombre de tomes (série en cours, catalogue incomplet) ; retire les tomes au-delà
  static async setTotal(entryId, userId, value) {
    const entry = await VolumeService.#entry(entryId, userId);
    const total = parseNumber(value, MAX_VOLUMES);
    await db.query("UPDATE user_items SET volumes_total = $2 WHERE id_user_item = $1", [entry.id, total]);
    await db.query("DELETE FROM entry_volumes WHERE user_item_id = $1 AND number > $2", [entry.id, total]);
    return VolumeService.get(entryId, userId);
  }

  // Marque d'un coup tous les tomes jusqu'à « upTo » comme possédés (les tomes lus restent lus)
  static async ownUpTo(entryId, userId, upTo) {
    const { entry, total } = await VolumeService.get(entryId, userId);
    const n = parseNumber(upTo, Math.max(total, 1));
    await db.query(
      `INSERT INTO entry_volumes (user_item_id, number, state)
       SELECT $1, g, 'owned' FROM generate_series(1, $2::int) AS g
       ON CONFLICT (user_item_id, number) DO NOTHING`,
      [entry.id, n],
    );
    return VolumeService.get(entryId, userId);
  }
}

export default VolumeService;

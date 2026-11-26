"use strict";

import db from "../../config/database.js";

/**
 * Mémoire des appels d'API déjà faits : requêtes de recherche, similaires
 * d'une œuvre, correspondances d'import validées. Les œuvres elles-mêmes
 * sont dans items ; ces tables ne gardent que des listes d'identifiants.
 */
class CatalogCacheRepository {
  static async getSearch(source, typeKey, queryNorm, maxAgeDays) {
    const { rows } = await db.query(
      `SELECT item_ids FROM search_cache
       WHERE source = $1 AND type_key = $2 AND query_norm = $3 AND fetched_at > NOW() - make_interval(days => $4)`,
      [source, typeKey, queryNorm, maxAgeDays],
    );
    return rows[0]?.item_ids ?? null;
  }

  static async setSearch(source, typeKey, queryNorm, itemIds) {
    await db.query(
      `INSERT INTO search_cache (source, type_key, query_norm, item_ids) VALUES ($1, $2, $3, $4)
       ON CONFLICT (source, type_key, query_norm) DO UPDATE SET item_ids = EXCLUDED.item_ids, fetched_at = NOW()`,
      [source, typeKey, queryNorm, itemIds],
    );
  }

  static async getSimilar(itemId, maxAgeDays) {
    const { rows } = await db.query(
      `SELECT similar_ids FROM item_similar WHERE item_id = $1 AND fetched_at > NOW() - make_interval(days => $2)`,
      [itemId, maxAgeDays],
    );
    return rows[0]?.similar_ids ?? null;
  }

  static async setSimilar(itemId, similarIds) {
    await db.query(
      `INSERT INTO item_similar (item_id, similar_ids) VALUES ($1, $2)
       ON CONFLICT (item_id) DO UPDATE SET similar_ids = EXCLUDED.similar_ids, fetched_at = NOW()`,
      [itemId, similarIds],
    );
  }

  static async findImportMatch(type, keyNorm) {
    const { rows } = await db.query(`SELECT item_id FROM import_matches WHERE item_type = $1 AND key_norm = $2`, [
      type,
      keyNorm,
    ]);
    return rows[0]?.item_id ?? null;
  }

  // Une correspondance confirmée remplace l'ancienne si l'œuvre diffère
  static async recordImportMatch(type, keyNorm, itemId) {
    await db.query(
      `INSERT INTO import_matches (item_type, key_norm, item_id) VALUES ($1, $2, $3)
       ON CONFLICT (item_type, key_norm) DO UPDATE SET
         confirmations = CASE WHEN import_matches.item_id = EXCLUDED.item_id THEN import_matches.confirmations + 1 ELSE 1 END,
         item_id = EXCLUDED.item_id,
         updated_at = NOW()`,
      [type, keyNorm, itemId],
    );
  }
}

export default CatalogCacheRepository;

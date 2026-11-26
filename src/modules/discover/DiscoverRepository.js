"use strict";

import db from "../../config/database.js";

class DiscoverRepository {
  // Œuvres les mieux notées ou favorites : point de départ des suggestions
  static async findSeeds(userId, type, limit = 12) {
    const { rows } = await db.query(
      `
        SELECT i.id_item AS id, i.item_type AS type, i.source, i.external_id AS "externalId", i.title, i.genres
        FROM user_items ui JOIN items i ON i.id_item = ui.item_id
        WHERE ui.user_id = $1 AND i.item_type = $2
          AND (ui.is_favorite OR ui.rating >= 7 OR (ui.rating IS NULL AND ui.status = 'completed'))
        ORDER BY ui.is_favorite DESC, ui.rating DESC NULLS LAST, ui.updated_at DESC NULLS LAST
        LIMIT $3
      `,
      [userId, type, limit],
    );
    return rows;
  }

  // Œuvres déjà suivies (source:id), pour ne pas les reproposer
  static async findOwnedKeys(userId) {
    const { rows } = await db.query(
      `SELECT i.source || ':' || i.external_id AS key FROM user_items ui JOIN items i ON i.id_item = ui.item_id WHERE ui.user_id = $1`,
      [userId],
    );
    return new Set(rows.map((r) => r.key));
  }

  static async findPicks(userId, date) {
    const { rows } = await db.query(
      `SELECT item_type, items, created_at FROM daily_picks WHERE user_id = $1 AND pick_date = $2`,
      [userId, date],
    );
    return new Map(rows.map((r) => [r.item_type, { items: r.items, createdAt: r.created_at }]));
  }

  static async savePicks(userId, date, type, items) {
    await db.query(
      `
        INSERT INTO daily_picks (user_id, pick_date, item_type, items) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, pick_date, item_type) DO UPDATE SET items = EXCLUDED.items, created_at = NOW()
      `,
      [userId, date, type, JSON.stringify(items)],
    );
    // On ne garde que la semaine en cours
    await db.query(`DELETE FROM daily_picks WHERE user_id = $1 AND pick_date < $2::date - 7`, [userId, date]);
  }

  static async findTrendingCache(type) {
    const { rows } = await db.query(`SELECT items, fetched_at FROM trending_cache WHERE item_type = $1`, [type]);
    return rows[0] ? { items: rows[0].items, fetchedAt: rows[0].fetched_at } : null;
  }

  static async saveTrendingCache(type, items) {
    await db.query(
      `
        INSERT INTO trending_cache (item_type, items, fetched_at) VALUES ($1, $2, NOW())
        ON CONFLICT (item_type) DO UPDATE SET items = EXCLUDED.items, fetched_at = NOW()
      `,
      [type, JSON.stringify(items)],
    );
  }

  // Les plus ajoutées sur Cocon ces 7 derniers jours
  static async findCoconTrends(type, limit = 10) {
    const { rows } = await db.query(
      `
        SELECT i.item_type AS type, i.source, i.external_id AS "externalId", i.title, i.cover_url AS "coverUrl",
               i.release_date AS "releaseDate", COUNT(DISTINCT ui.user_id)::int AS people
        FROM user_items ui JOIN items i ON i.id_item = ui.item_id
        WHERE ui.created_at > NOW() - INTERVAL '7 days' AND ($1::item_type_enum IS NULL OR i.item_type = $1)
        GROUP BY i.id_item
        ORDER BY people DESC, MAX(ui.created_at) DESC
        LIMIT $2
      `,
      [type, limit],
    );
    return rows;
  }
}

export default DiscoverRepository;

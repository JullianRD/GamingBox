"use strict";

import db from "../config/database.js";

/** Agrégats de statistiques d'un utilisateur (SQL côté base, aucune ligne chargée en mémoire). */
class StatsRepository {
  static async availableYears(userId) {
    const { rows } = await db.query(
      "SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year FROM reviews WHERE user_id = $1 ORDER BY year DESC",
      [userId],
    );
    return rows.map((r) => r.year);
  }

  /** @param {number|null} year null = toute la bibliothèque */
  static async summary(userId, year = null) {
    const params = [userId, year];
    const scope =
      "WHERE r.user_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM r.created_at) = $2::int)";

    const [totals, byStatus, byGenre, byPlatform, byMonth, top] = await Promise.all([
      db.query(
        /*sql*/ `
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE progression_status = 'Terminé')::int AS finished,
                 COUNT(*) FILTER (WHERE review_platine)::int AS platinum,
                 COUNT(*) FILTER (WHERE review_like)::int AS liked,
                 ROUND(AVG(review_rate) FILTER (WHERE review_rate > 0), 2) AS average_rating
          FROM reviews r ${scope}`,
        params,
      ),
      db.query(
        `SELECT progression_status AS label, COUNT(*)::int AS total FROM reviews r ${scope} GROUP BY 1 ORDER BY 2 DESC`,
        params,
      ),
      db.query(
        /*sql*/ `
          SELECT g.game_genre AS label, COUNT(*)::int AS total
          FROM reviews r JOIN games g ON g.id_game = r.game_id ${scope}
          GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
        params,
      ),
      db.query(
        `SELECT game_platforme AS label, COUNT(*)::int AS total FROM reviews r ${scope} GROUP BY 1 ORDER BY 2 DESC`,
        params,
      ),
      db.query(
        /*sql*/ `
          SELECT EXTRACT(MONTH FROM created_at)::int AS month, COUNT(*)::int AS total
          FROM reviews r ${scope} AND progression_status = 'Terminé'
          GROUP BY 1 ORDER BY 1`,
        params,
      ),
      db.query(
        /*sql*/ `
          SELECT r.review_title, r.slug, r.review_rate, g.game_title
          FROM reviews r JOIN games g ON g.id_game = r.game_id ${scope}
          ORDER BY r.review_rate DESC, r.created_at DESC LIMIT 5`,
        params,
      ),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: byMonth.rows.find((r) => r.month === i + 1)?.total ?? 0,
    }));

    return {
      totals: totals.rows[0],
      byStatus: byStatus.rows,
      byGenre: byGenre.rows,
      byPlatform: byPlatform.rows,
      finishedByMonth: months,
      top: top.rows,
    };
  }
}

export default StatsRepository;

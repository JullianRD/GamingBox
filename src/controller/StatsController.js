"use strict";

import StatsRepository from "../repositories/PgStatsRepository.js";

class StatsController {
  async index(req, res) {
    const userId = req.session.userId;
    const years = await StatsRepository.availableYears(userId);

    const requested = req.query.year === "all" ? null : Number(req.query.year);
    const year =
      requested === null
        ? null
        : Number.isInteger(requested) && years.includes(requested)
          ? requested
          : (years[0] ?? null);

    const stats = await StatsRepository.summary(userId, year);

    return res.render("pages/stats/index", {
      title: "Mes statistiques - GamingBox",
      stats,
      years,
      year,
      user: res.locals.currentUser || null,
      flash: res.locals.flash || {},
    });
  }
}

export default new StatsController();

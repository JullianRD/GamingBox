"use strict";

import AppEventAdminService from "../services/AppEventAdminService.js";
import AppEventService from "../services/AppEventService.js";

/**
 * Controller ADMIN : exploitation des événements applicatifs (API JSON).
 * Les erreurs (AppError) sont traduites par le handler global.
 */
class AppEventController {
  async stats(req, res) {
    res.json(await AppEventAdminService.getStats());
  }

  async index(req, res) {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const events = await AppEventAdminService.listEvents({ limit, offset });
    res.json({ limit, offset, count: events.length, events });
  }

  async show(req, res) {
    res.json(await AppEventAdminService.getEventById(req.params.id));
  }

  async destroy(req, res) {
    await AppEventAdminService.deleteEvent({ eventId: req.params.id });
    await AppEventService.adminAction(req.session.userId, "event_deleted", { eventId: req.params.id });
    res.json({ message: "Événement supprimé avec succès" });
  }

  async cleanup(req, res) {
    const days = Number(req.body?.days ?? 90);
    const result = await AppEventAdminService.cleanupOldEvents({ days });
    await AppEventService.adminAction(req.session.userId, "events_cleanup", { days, deleted: result.deletedCount });
    res.json({ message: `${result.deletedCount} événements supprimés.`, cutoffDate: result.cutoffDate });
  }
}

export default new AppEventController();

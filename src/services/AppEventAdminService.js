"use strict";

import AppEventRepository from "../repositories/PgAppEventRepository.js";
import { AppError } from "../utils/AppError.js";

class AppEventAdminService {
  static async getStats() {
    const [totalEvents, eventsByType, eventsByDay, topUsers, recentErrors] = await Promise.all([
      AppEventRepository.count(),
      AppEventRepository.countByType(),
      AppEventRepository.countByDay({ days: 30 }),
      AppEventRepository.topUsers({ limit: 10 }),
      AppEventRepository.findErrors({ limit: 50 }),
    ]);
    return { totalEvents, eventsByType, eventsByDay, topUsers, recentErrors };
  }

  static async listEvents({ limit = 50, offset = 0 } = {}) {
    return AppEventRepository.findAll({ limit, offset });
  }

  static async getEventById(eventId) {
    const event = await AppEventRepository.findById(eventId);
    if (!event) throw AppError.notFound("Événement introuvable.");
    return event;
  }

  static async deleteEvent({ eventId }) {
    const event = await this.getEventById(eventId);
    await AppEventRepository.delete(eventId);
    return event;
  }

  static async cleanupOldEvents({ days }) {
    if (!Number.isInteger(days) || days < 1) throw AppError.badRequest("Nombre de jours invalide.");
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deletedCount = await AppEventRepository.deleteOlderThan(cutoffDate);
    return { deletedCount, cutoffDate };
  }
}

export default AppEventAdminService;

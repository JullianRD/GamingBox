"use strict";

import ItemRepository from "./ItemRepository.js";
import { getProvider } from "./providers/index.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../config/logger.js";

class CatalogService {
  // Trouve l'œuvre en base, sinon la récupère chez sa source et l'enregistre
  static async resolveItem(source, externalId) {
    const existing = await ItemRepository.findBySource(source, externalId);
    if (existing) return existing;

    const provider = getProvider(source);
    if (!provider) throw new AppError("Source inconnue.", 404);

    const fetched = await provider.fetchItem(externalId);
    if (!fetched) throw new AppError("Œuvre introuvable.", 404);

    return ItemRepository.upsert(fetched);
  }

  // Personnages d'une œuvre : en base, sinon une seule récupération chez la source
  static async getEntities(item, userId) {
    const provider = getProvider(item.source);
    if (!item.metadata?.entitiesFetchedAt && provider?.fetchCharacters) {
      try {
        const entities = await provider.fetchCharacters(item.externalId);
        await ItemRepository.replaceEntities(item.id, item.source, entities);
      } catch (error) {
        logger.warn({ err: error, itemId: item.id }, "Personnages indisponibles");
        return { entities: await ItemRepository.findEntities(item.id, userId), unavailable: true };
      }
    }
    return { entities: await ItemRepository.findEntities(item.id, userId), unavailable: false };
  }
}

export default CatalogService;

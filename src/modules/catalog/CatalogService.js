"use strict";

import ItemRepository from "./ItemRepository.js";
import { getProvider, providerForType, allProviders } from "./providers/index.js";
import { fetchAnimeThemes } from "./providers/jikan.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../config/logger.js";

const SEARCH_TIMEOUT = 6000;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), ms))]);

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

  // Enregistre une œuvre déjà décrite (résultat de recherche, import, recommandation)
  static saveItem(item) {
    return ItemRepository.upsert(item);
  }

  /**
   * Recherche dans une catégorie ou dans toutes. Une source en panne ne bloque pas
   * les autres : elle est signalée dans `unavailable`.
   */
  static async search(query, { type = null } = {}) {
    const targets = type
      ? [{ provider: providerForType(type), type }]
      : allProviders().map((provider) => ({ provider, type: null }));

    const settled = await Promise.allSettled(
      targets
        .filter(({ provider }) => provider?.configured())
        .map(({ provider, type: t }) =>
          withTimeout(provider.search(query, { type: t }), SEARCH_TIMEOUT).then((items) => ({ provider, items })),
        ),
    );

    const results = [];
    const unavailable = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") results.push(...outcome.value.items);
      else {
        const provider = targets.filter(({ provider: p }) => p?.configured())[index].provider;
        unavailable.push(provider.label);
        logger.warn({ err: outcome.reason, source: provider.source }, "Recherche indisponible");
      }
    });
    const notConfigured = targets.filter(({ provider }) => provider && !provider.configured()).map(({ provider }) => provider.label);
    return { results, unavailable: [...unavailable, ...notConfigured] };
  }

  // Personnages (et openings pour un anime) : en base, sinon une seule récupération
  static async getEntities(item, userId) {
    const provider = getProvider(item.source);
    if (!item.metadata?.entitiesFetchedAt && provider?.fetchEntities) {
      try {
        const entities = await provider.fetchEntities(item.externalId);
        if (item.type === "anime" && item.metadata?.idMal) {
          entities.push(...(await fetchAnimeThemes(item.metadata.idMal).catch(() => [])));
        }
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

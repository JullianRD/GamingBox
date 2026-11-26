"use strict";

import ItemRepository from "./ItemRepository.js";
import CatalogCacheRepository from "./CatalogCacheRepository.js";
import { normalizeTitle, scoreCandidate } from "../imports/matching.js";
import { getProvider, providerForType, allProviders } from "./providers/index.js";
import { fetchAnimeThemes } from "./providers/jikan.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../config/logger.js";

const SEARCH_TIMEOUT = 6000;

// Durées de conservation (jours)
export const SEARCH_CACHE_DAYS = 7;
export const SIMILAR_CACHE_DAYS = 30;
const REFRESH_DAYS = 30;
const REFRESH_DAYS_ONGOING = 7;

// Assez de résultats en base pour ne pas interroger l'API (sauf « Chercher plus loin »)
export const LOCAL_ENOUGH = 6;

const DAY = 24 * 60 * 60 * 1000;

// Une fiche détaillée est à relire chez sa source après 30 jours, 7 si l'œuvre est en cours ou récente
export const isStale = (item, now = Date.now()) => {
  if (!item?.metadata?.detailed || !item.fetchedAt) return false;
  const age = now - new Date(item.fetchedAt).getTime();
  const released = item.releaseDate ? new Date(item.releaseDate).getTime() : null;
  const recent = released !== null && now - released < 365 * DAY;
  const ongoing = item.metadata.ongoing === true || recent;
  return age > (ongoing ? REFRESH_DAYS_ONGOING : REFRESH_DAYS) * DAY;
};

const refreshing = new Set();

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), ms))]);

class CatalogService {
  /**
   * Trouve l'œuvre en base, sinon la récupère chez sa source et l'enregistre.
   * Une œuvre vue seulement en recherche (fiche légère) est complétée une fois.
   */
  static async resolveItem(source, externalId) {
    const existing = await ItemRepository.findBySource(source, externalId);
    if (existing?.metadata?.detailed) {
      if (isStale(existing)) CatalogService.refreshInBackground(existing);
      return existing;
    }

    const provider = getProvider(source);
    if (!provider) throw new AppError("Source inconnue.", 404);

    let fetched;
    try {
      fetched = provider.configured?.() === false ? null : await provider.fetchItem(externalId);
    } catch (error) {
      // API indisponible ou quota atteint : la fiche légère suffit pour avancer
      if (existing) return existing;
      throw error;
    }
    if (!fetched) {
      if (existing) return existing;
      throw new AppError("Œuvre introuvable.", 404);
    }
    return ItemRepository.upsert({ ...fetched, metadata: { ...fetched.metadata, detailed: true } });
  }

  // Relit une fiche périmée sans faire attendre la page ; un échec garde l'ancienne version
  static refreshInBackground(item) {
    const key = `${item.source}:${item.externalId}`;
    const provider = getProvider(item.source);
    if (refreshing.has(key) || !provider?.fetchItem || provider.configured?.() === false) return null;
    refreshing.add(key);
    return provider
      .fetchItem(item.externalId)
      .then((fetched) => fetched && ItemRepository.upsert({ ...fetched, metadata: { ...fetched.metadata, detailed: true } }))
      .catch((error) => logger.debug({ err: error, itemId: item.id }, "Rafraîchissement reporté"))
      .finally(() => refreshing.delete(key));
  }

  // Enregistre une œuvre déjà décrite (résultat de recherche, import, recommandation)
  static saveItem(item) {
    return ItemRepository.upsert(item);
  }

  /**
   * Recherche : notre base d'abord, puis les API seulement si elle ne suffit pas
   * (ou sur « Chercher plus loin »). Une requête déjà posée à une API n'est pas
   * reposée pendant 7 jours, et chaque œuvre trouvée est enregistrée en base.
   * Une source en panne ou à court de quota ne bloque pas les autres : elle est
   * signalée dans `unavailable`.
   */
  static async search(query, { type = null, deep = false } = {}) {
    const queryNorm = (normalizeTitle(query) || String(query).toLowerCase().trim()).slice(0, 200);
    const local = await ItemRepository.searchLocal(query, { type, limit: 30 });

    const targets = (type ? [providerForType(type)] : allProviders()).filter(Boolean);
    const configured = targets.filter((provider) => provider.configured());
    const typeKey = type ?? "";
    const enoughLocally = (provider) =>
      local.filter((item) => provider.types.includes(item.type) && scoreCandidate({ title: query }, item) >= 0.6).length >= LOCAL_ENOUGH;

    let skipped = false;
    const settled = await Promise.allSettled(
      configured.map(async (provider) => {
        const cached = await CatalogCacheRepository.getSearch(provider.source, typeKey, queryNorm, SEARCH_CACHE_DAYS);
        if (cached) return ItemRepository.findByIds(cached);
        if (!deep && enoughLocally(provider)) {
          skipped = true;
          return [];
        }
        const found = await withTimeout(provider.search(query, { type }), SEARCH_TIMEOUT);
        const saved = await ItemRepository.upsertMany(found, { fresh: false });
        await CatalogCacheRepository.setSearch(provider.source, typeKey, queryNorm, saved.map((item) => item.id));
        return saved;
      }),
    );

    const fromApis = [];
    const unavailable = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") fromApis.push(...outcome.value);
      else {
        unavailable.push(configured[index].label);
        logger.warn({ err: outcome.reason, source: configured[index].source }, "Recherche indisponible");
      }
    });
    const notConfigured = targets.filter((provider) => !provider.configured()).map((provider) => provider.label);

    // Fusion sans doublon, les titres les plus proches de la requête d'abord
    const seen = new Set();
    const merged = [...fromApis, ...local].filter((item) => {
      if (type && item.type !== type) return false;
      const key = item.id ?? `${item.source}:${item.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const rank = new Map(merged.map((item, index) => [item, scoreCandidate({ title: query }, item) - index * 0.001]));
    merged.sort((a, b) => rank.get(b) - rank.get(a));

    return { results: merged.slice(0, 40), unavailable: [...unavailable, ...notConfigured], canSearchDeeper: skipped };
  }

  /**
   * Œuvres similaires (recommandations du jour), gardées 30 jours par œuvre et
   * partagées entre utilisateurs. Les œuvres trouvées sont enregistrées en base.
   */
  static async getSimilar(item) {
    const cached = await CatalogCacheRepository.getSimilar(item.id, SIMILAR_CACHE_DAYS);
    if (cached) return ItemRepository.findByIds(cached);
    const provider = getProvider(item.source);
    if (!provider?.similar || !provider.configured()) return [];
    const found = await withTimeout(provider.similar(item), SEARCH_TIMEOUT);
    const saved = await ItemRepository.upsertMany(found, { fresh: false });
    await CatalogCacheRepository.setSimilar(item.id, saved.map((s) => s.id));
    return saved;
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

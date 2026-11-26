"use strict";

import DiscoverRepository from "./DiscoverRepository.js";
import { providerForType } from "../catalog/providers/index.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";
import { logger } from "../../config/logger.js";

/**
 * Recommandations du jour : pour chaque catégorie, quelques œuvres proches de
 * celles que l'utilisateur a aimées (API « similaires » de chaque source),
 * sinon les tendances de la semaine. Calculées une fois par jour et gardées.
 */

const PICKS_PER_TYPE = 6;
const SEEDS_PER_DAY = 3;
const TIMEOUT = 6000;
const TRENDING_TTL = 6 * 3600 * 1000;
const RETRY_EMPTY = 3600 * 1000;

const withTimeout = (promise) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), TIMEOUT))]);

export const today = (now = new Date()) => now.toISOString().slice(0, 10);

// Mélange stable pour la journée : mêmes suggestions toute la journée
export const dailyShuffle = (list, seedText) => {
  let seed = [...seedText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const toCard = (item, reason = null) => ({
  type: item.type,
  source: item.source,
  externalId: String(item.externalId),
  title: item.title,
  coverUrl: item.coverUrl ?? null,
  releaseDate: item.releaseDate ?? null,
  href: `/ajouter/${item.source}/${encodeURIComponent(item.externalId)}`,
  meta: reason,
});

// Assemble les suggestions : une par graine à tour de rôle, sans doublon ni œuvre déjà suivie
export const interleave = (groups, owned, limit) => {
  const seen = new Set();
  const out = [];
  const queues = groups.map((g) => [...g.items]);
  while (out.length < limit && queues.some((q) => q.length)) {
    queues.forEach((queue, index) => {
      while (queue.length && out.length < limit) {
        const item = queue.shift();
        const key = `${item.source}:${item.externalId}`;
        if (owned.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(toCard(item, groups[index].reason));
        break;
      }
    });
  }
  return out;
};

class DiscoverService {
  static enabledTypes() {
    return Object.values(ITEM_TYPES).filter((t) => t.enabled && providerForType(t.code)?.configured());
  }

  static async getTrending(type) {
    const cached = await DiscoverRepository.findTrendingCache(type);
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < TRENDING_TTL) return cached.items;
    const provider = providerForType(type);
    if (!provider?.configured() || !provider.trending) return cached?.items ?? [];
    try {
      const items = (await withTimeout(provider.trending(type))).filter((i) => i.type === type).map((i) => toCard(i));
      await DiscoverRepository.saveTrendingCache(type, items);
      return items;
    } catch (error) {
      logger.warn({ err: error, type }, "Tendances indisponibles");
      return cached?.items ?? [];
    }
  }

  static async computePicks(userId, type, date, owned) {
    const provider = providerForType(type);
    const seeds = dailyShuffle(await DiscoverRepository.findSeeds(userId, type), `${userId}${date}${type}`).slice(0, SEEDS_PER_DAY);
    const groups = [];
    if (provider?.similar) {
      const settled = await Promise.allSettled(seeds.map((seed) => withTimeout(provider.similar(seed))));
      settled.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          groups.push({ reason: `Parce que tu as aimé ${seeds[index].title}`, items: outcome.value.filter((i) => i.type === type) });
        }
      });
    }
    let picks = interleave(groups, owned, PICKS_PER_TYPE);
    if (picks.length < PICKS_PER_TYPE) {
      const trending = (await this.getTrending(type)).map((card) => ({ ...card, meta: "Tendance cette semaine" }));
      const keys = new Set(picks.map((p) => `${p.source}:${p.externalId}`));
      const extra = dailyShuffle(trending, `${userId}${date}`).filter((c) => !owned.has(`${c.source}:${c.externalId}`) && !keys.has(`${c.source}:${c.externalId}`));
      picks = [...picks, ...extra].slice(0, PICKS_PER_TYPE);
    }
    return picks;
  }

  // Suggestions du jour, par catégorie (calculées au premier passage de la journée)
  static async getDailyPicks(userId, { types = null } = {}) {
    const date = today();
    const wanted = this.enabledTypes().filter((t) => !types || types.includes(t.code));
    const stored = await DiscoverRepository.findPicks(userId, date);
    let owned = null;

    const result = await Promise.all(
      wanted.map(async (t) => {
        const cached = stored.get(t.code);
        const fresh = cached && (cached.items.length || Date.now() - new Date(cached.createdAt).getTime() < RETRY_EMPTY);
        if (fresh) return { type: t, picks: cached.items };
        owned ??= await DiscoverRepository.findOwnedKeys(userId);
        const picks = await this.computePicks(userId, t.code, date, owned);
        await DiscoverRepository.savePicks(userId, date, t.code, picks);
        return { type: t, picks };
      }),
    );
    return result.filter((r) => r.picks.length);
  }

  // Tendances d'une catégorie : sur Cocon (7 jours) et chez la source
  static async getTrends(type) {
    const [cocon, external] = await Promise.all([DiscoverRepository.findCoconTrends(type), type ? this.getTrending(type) : []]);
    return {
      cocon: cocon.map((item) => toCard(item, `${item.people} ${item.people > 1 ? "personnes" : "personne"} cette semaine`)),
      external,
      sourceLabel: providerForType(type)?.label ?? null,
    };
  }
}

export default DiscoverService;

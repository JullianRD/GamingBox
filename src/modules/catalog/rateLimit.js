"use strict";

/**
 * Limiteur de débit par fournisseur (seau à jetons, en mémoire du processus).
 * Chaque appel sortant réserve un jeton ; s'il faudrait attendre trop longtemps,
 * l'appel est refusé et l'appelant se rabat sur ce qu'on a déjà en base.
 * Un 429 met la source en pause pour la durée indiquée par l'API.
 */

// Débits retenus, un peu sous les quotas publiés
const LIMITS = {
  IGDB: { perSecond: 4, burst: 4 }, // 4 req/s
  AniList: { perSecond: 30 / 60, burst: 10 }, // 90/min annoncés, 30/min en mode dégradé
  Jikan: { perSecond: 1, burst: 3 }, // 3/s et 60/min
  TMDB: { perSecond: 40, burst: 20 }, // ~50/s
  "Open Library": { perSecond: 1, burst: 5 }, // pas de quota chiffré : rester sobre
  Deezer: { perSecond: 8, burst: 10 }, // 50 requêtes / 5 s
  "Last.fm": { perSecond: 4, burst: 5 }, // 5/s
  Steam: { perSecond: 1, burst: 5 }, // 100 000/jour
  Trakt: { perSecond: 3, burst: 5 }, // 1 000 / 5 min
};
const DEFAULT_LIMIT = { perSecond: 2, burst: 5 };
export const DEFAULT_MAX_WAIT = 5000;

const buckets = new Map();

const bucketFor = (source) => {
  if (!buckets.has(source)) {
    const { perSecond, burst } = LIMITS[source] ?? DEFAULT_LIMIT;
    buckets.set(source, { rate: perSecond / 1000, burst, tokens: burst, updatedAt: Date.now(), pausedUntil: 0 });
  }
  return buckets.get(source);
};

export class RateLimitError extends Error {
  constructor(source, waitMs) {
    super(`${source} : quota atteint, réessaie dans ${Math.ceil(waitMs / 1000)} s`);
    this.source = source;
    this.waitMs = waitMs;
  }
}

// Délai avant qu'un jeton soit disponible, sans le réserver
export const waitTime = (source, now = Date.now()) => {
  const bucket = bucketFor(source);
  const tokens = Math.min(bucket.burst, bucket.tokens + (now - bucket.updatedAt) * bucket.rate);
  return Math.max(bucket.pausedUntil - now, tokens >= 1 ? 0 : (1 - tokens) / bucket.rate);
};

// Réserve un jeton ; attend si besoin, ou refuse si l'attente dépasse maxWait
export const acquire = async (source, { maxWait = DEFAULT_MAX_WAIT } = {}) => {
  const now = Date.now();
  const bucket = bucketFor(source);
  bucket.tokens = Math.min(bucket.burst, bucket.tokens + (now - bucket.updatedAt) * bucket.rate);
  bucket.updatedAt = now;
  const wait = Math.max(bucket.pausedUntil - now, bucket.tokens >= 1 ? 0 : (1 - bucket.tokens) / bucket.rate);
  if (wait > maxWait) throw new RateLimitError(source, wait);
  bucket.tokens -= 1; // peut passer sous zéro : les appels suivants font la queue
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
};

// L'API a répondu 429 : pause de la source
export const pause = (source, ms) => {
  const bucket = bucketFor(source);
  bucket.pausedUntil = Math.max(bucket.pausedUntil, Date.now() + ms);
};

// Durée de pause à partir de l'en-tête Retry-After (secondes), 60 s par défaut
export const retryAfterMs = (header) => {
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : 60_000;
};

export const resetLimits = () => buckets.clear();

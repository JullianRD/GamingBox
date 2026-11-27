"use strict";

/**
 * Compteurs d'appels aux API et d'usage du catalogue local, en mémoire du
 * processus (remis à zéro au redémarrage). Affichés dans Admin > Santé des API.
 */
const startedAt = new Date();
const sources = new Map();
const catalog = {
  searchLocalOnly: 0, // recherche servie par notre base sans appel
  searchCacheHit: 0, // requête déjà posée à une API (search_cache)
  searchApi: 0, // appel d'API pour une recherche
  resolveLocal: 0, // fiche déjà complète en base
  resolveApi: 0, // fiche complétée chez la source
  similarCacheHit: 0,
  similarApi: 0,
  refreshes: 0,
};

const sourceStats = (source) => {
  if (!sources.has(source)) {
    sources.set(source, { calls: 0, errors: 0, refused: 0, throttled: 0, lastCallAt: null, lastError: null });
  }
  return sources.get(source);
};

export const recordCall = (source) => {
  const s = sourceStats(source);
  s.calls += 1;
  s.lastCallAt = new Date();
};
export const recordError = (source, message) => {
  const s = sourceStats(source);
  s.errors += 1;
  s.lastError = { message: String(message).slice(0, 200), at: new Date() };
};
// Refus par notre limiteur (quota local) ou 429 renvoyé par l'API
export const recordRefused = (source) => (sourceStats(source).refused += 1);
export const recordThrottled = (source) => (sourceStats(source).throttled += 1);
export const count = (key) => {
  if (key in catalog) catalog[key] += 1;
};

export const snapshot = () => ({
  startedAt,
  sources: [...sources.entries()].map(([source, s]) => ({ source, ...s })).sort((a, b) => b.calls - a.calls),
  catalog: { ...catalog },
});

export const resetStats = () => {
  sources.clear();
  for (const key of Object.keys(catalog)) catalog[key] = 0;
};

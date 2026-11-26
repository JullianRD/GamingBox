"use strict";

import { AppError } from "../../utils/AppError.js";
import { acquire, pause, retryAfterMs, RateLimitError } from "./rateLimit.js";

/**
 * Appel JSON vers une API externe, avec délai maximal.
 * Une erreur réseau ou HTTP devient une ProviderError, que l'appelant peut
 * afficher comme « indisponible » sans planter la page.
 */
export class ProviderError extends AppError {
  constructor(source, message) {
    super(`${source} : ${message}`, 502);
    this.source = source;
  }
}

export const fetchJson = async (source, url, { method = "GET", headers = {}, body, timeout = 8000, maxWait } = {}) => {
  try {
    await acquire(source, { maxWait });
  } catch (error) {
    if (error instanceof RateLimitError) throw Object.assign(new ProviderError(source, "quota atteint pour le moment"), { rateLimited: true });
    throw error;
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...headers },
      body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    throw new ProviderError(source, `service injoignable (${error.name})`);
  }
  if (response.status === 429) {
    pause(source, retryAfterMs(response.headers.get("retry-after")));
    throw Object.assign(new ProviderError(source, "quota atteint pour le moment"), { rateLimited: true });
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ProviderError(source, `HTTP ${response.status} ${text.slice(0, 200)}`);
  }
  return response.json();
};

// Exécute des appels un par un avec un intervalle minimal (API limitées en débit)
export const createThrottle = (intervalMs) => {
  let last = 0;
  let chain = Promise.resolve();
  return (task) => {
    const run = chain.then(async () => {
      const wait = last + intervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      last = Date.now();
      return task();
    });
    chain = run.catch(() => {});
    return run;
  };
};

// Exécute une fonction sur une liste avec une concurrence limitée
export const mapLimit = async (list, limit, fn) => {
  const results = new Array(list.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (index < list.length) {
      const current = index++;
      results[current] = await fn(list[current], current);
    }
  });
  await Promise.all(workers);
  return results;
};

export const yearOf = (date) => (date ? Number(String(date).slice(0, 4)) || null : null);

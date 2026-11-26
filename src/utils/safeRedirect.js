"use strict";

/**
 * Retourne une cible de redirection sûre : un chemin interne uniquement.
 * Refuse les URLs absolues, `//host`, `/\host` et tout caractère de contrôle
 * (contre les redirections ouvertes).
 *
 * @param {unknown} target
 * @param {string} fallback
 * @returns {string}
 */
export function safeRedirect(target, fallback = "/") {
  if (typeof target !== "string") return fallback;

  const value = target.trim();

  const isInternalPath = /^\/(?![/\\])/.test(value);
  // eslint-disable-next-line no-control-regex
  const hasControlChars = /[\u0000-\u001f\u007f]/.test(value);

  return isInternalPath && !hasControlChars ? value : fallback;
}

/**
 * Cible de retour depuis l'en-tête Referer, limitée au même hôte.
 */
export function safeReferer(req, fallback = "/") {
  const referer = req.get("referer");
  if (!referer) return fallback;

  try {
    const url = new URL(referer);
    if (url.host !== req.get("host")) return fallback;
    return safeRedirect(`${url.pathname}${url.search}`, fallback);
  } catch {
    return fallback;
  }
}

"use strict";

/**
 * Choix de la bonne œuvre parmi les résultats d'une recherche.
 * Une correspondance est retenue seule si le titre est le même (à la casse,
 * aux accents et à la ponctuation près), l'année proche, et qu'aucune autre
 * proposition ne fait aussi bien. Sinon l'utilisateur tranche à la revue.
 */

export const normalizeTitle = (title) =>
  String(title ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^(the|le|la|les|l')\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (title) => new Set(normalizeTitle(title).split(" ").filter(Boolean));

const titleScore = (a, b) => {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  const common = [...ta].filter((t) => tb.has(t)).length;
  const jaccard = common / new Set([...ta, ...tb]).size;
  return na.includes(nb) || nb.includes(na) ? Math.max(0.6, jaccard) : jaccard * 0.8;
};

const yearOfItem = (item) => (item.releaseDate ? Number(String(item.releaseDate).slice(0, 4)) : null);

const creatorsOf = (item) => [item.metadata?.artist, ...(item.metadata?.authors ?? [])].filter(Boolean).map(normalizeTitle);

export const scoreCandidate = (row, item) => {
  const titles = [item.title, item.metadata?.originalTitle, item.metadata?.englishTitle].filter(Boolean);
  let score = Math.max(...titles.map((t) => titleScore(row.title, t)));
  const year = yearOfItem(item);
  if (row.year && year) {
    const delta = Math.abs(row.year - year);
    score += delta === 0 ? 0.3 : delta === 1 ? 0.15 : -0.3;
  }
  if (row.creator) {
    const wanted = normalizeTitle(row.creator);
    if (creatorsOf(item).some((c) => c === wanted || c.includes(wanted) || wanted.includes(c))) score += 0.3;
  }
  return score;
};

export const pickMatch = (row, candidates) => {
  const ranked = candidates
    .map((item) => ({ item, score: scoreCandidate(row, item) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (!best) return { state: "unmatched", match: null, candidates: [] };
  const clear = best.score >= 1 && (!second || second.score <= best.score - 0.25);
  return clear
    ? { state: "matched", match: best.item, candidates: [] }
    : { state: "ambiguous", match: null, candidates: ranked.slice(0, 5).map((r) => r.item) };
};

"use strict";

/**
 * Tournoi à élimination directe pour les duels « Tu préfères ».
 * L'état est un objet simple (stocké en session) : indices des participants
 * du tour en cours, vainqueurs du tour, perdants dans l'ordre d'élimination.
 */

export const BRACKET_SIZES = [4, 8, 16, 32];

// Plus grande taille de tableau possible avec les participants disponibles
export const bracketSize = (wanted, available) => {
  const fitting = BRACKET_SIZES.filter((s) => s <= Math.min(wanted, available));
  return fitting.at(-1) ?? 0;
};

export const shuffle = (list, random = Math.random) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const createBracket = (contenders) => ({
  contenders,
  round: contenders.map((_, index) => index),
  next: [],
  pos: 0,
  roundNumber: 1,
  eliminated: [],
  champion: null,
});

export const roundLabel = (size) =>
  ({ 2: "Finale", 4: "Demi-finales", 8: "Quarts de finale", 16: "Huitièmes de finale", 32: "Seizièmes de finale" })[size] ?? `Tour de ${size}`;

export const currentPair = (state) =>
  state.champion !== null ? null : [state.contenders[state.round[state.pos]], state.contenders[state.round[state.pos + 1]]];

export const progress = (state) => {
  const total = state.contenders.length - 1;
  return { done: state.eliminated.length, total, match: state.pos / 2 + 1, matches: state.round.length / 2, label: roundLabel(state.round.length) };
};

export const choose = (state, pick) => {
  if (state.champion !== null) return state;
  const a = state.round[state.pos];
  const b = state.round[state.pos + 1];
  const [winner, loser] = Number(pick) === 1 ? [b, a] : [a, b];
  const next = [...state.next, winner];
  const eliminated = [...state.eliminated, loser];
  const pos = state.pos + 2;
  if (pos < state.round.length) return { ...state, next, eliminated, pos };
  if (next.length === 1) return { ...state, next: [], eliminated, pos, champion: winner };
  return { ...state, round: next, next: [], pos: 0, roundNumber: state.roundNumber + 1, eliminated };
};

// Classement final : vainqueur, finaliste, puis les éliminés du plus tard au plus tôt
export const ranking = (state) =>
  state.champion === null ? [] : [state.champion, ...[...state.eliminated].reverse()].map((index) => state.contenders[index]);

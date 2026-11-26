"use strict";

const UNITS = [
  ["an", 365 * 24 * 3600, "ans"],
  ["mois", 30 * 24 * 3600, "mois"],
  ["j", 24 * 3600, "j"],
  ["h", 3600, "h"],
  ["min", 60, "min"],
];

// « il y a 3 h », « à l'instant »
export const timeAgo = (date, now = new Date()) => {
  const seconds = Math.max(0, Math.floor((now - new Date(date)) / 1000));
  for (const [singular, size, plural] of UNITS) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `il y a ${value} ${value > 1 ? plural : singular}`;
  }
  return "à l'instant";
};

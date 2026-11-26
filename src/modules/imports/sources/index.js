"use strict";

import letterboxd from "./letterboxd.js";
import trakt from "./trakt.js";
import steam from "./steam.js";
import mal from "./mal.js";
import goodreads from "./goodreads.js";
import lastfm from "./lastfm.js";
import csv from "./csv.js";

// Ordre d'affichage sur la page des imports
const SOURCES = [letterboxd, trakt, steam, mal, goodreads, lastfm, csv];

export const getSource = (key) => SOURCES.find((s) => s.key === key) ?? null;
export const allSources = () => SOURCES;

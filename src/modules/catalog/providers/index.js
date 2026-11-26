"use strict";

import igdb, { igdbToItem } from "./igdb.js";
import tmdb from "./tmdb.js";
import anilist from "./anilist.js";
import openlibrary from "./openlibrary.js";
import deezer from "./deezer.js";

/**
 * Registre des fournisseurs de catalogue.
 * Chaque fournisseur expose : search, fetchItem, et selon les cas match,
 * fetchEntities, similar, trending.
 */
const providers = { igdb, tmdb, anilist, openlibrary, deezer };

export { igdbToItem };

export const getProvider = (source) => providers[source] ?? null;

// Fournisseur principal d'une catégorie
export const providerForType = (type) => Object.values(providers).find((p) => p.types.includes(type)) ?? null;

export const allProviders = () => Object.values(providers);

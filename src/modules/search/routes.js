"use strict";

import { Router } from "express";
import CatalogService from "../catalog/CatalogService.js";
import SocialService from "../social/SocialService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";

const router = Router();

const MIN_LENGTH = 2;

// Résultat de catalogue vers carte de la recherche (ajout via l'aperçu)
export const toSearchCard = (item) => ({
  type: item.type,
  title: item.title,
  coverUrl: item.coverUrl,
  meta: [item.releaseDate ? String(item.releaseDate).slice(0, 4) : null, item.metadata?.artist ?? item.metadata?.authors?.[0], item.genres?.[0]]
    .filter(Boolean)
    .join(" · "),
  href: `/ajouter/${item.source}/${encodeURIComponent(item.externalId)}`,
});

router.get("/recherche", requireAuth, async (req, res) => {
  const query = String(req.query.q || "").trim();
  const type = ITEM_TYPES[req.query.type]?.enabled ? req.query.type : null;
  const long = query.length >= MIN_LENGTH;

  const deep = req.query.plus === "1";
  const [catalog, people] = await Promise.all([
    long ? CatalogService.search(query, { type, deep }) : { results: [], unavailable: [], canSearchDeeper: false },
    long && !type ? SocialService.searchUsers(query, req.session.userId) : [],
  ]);

  const htmx = Boolean(req.get("HX-Request"));
  res.render(htmx ? "partials/search/results" : "pages/search/index", {
    title: "Recherche - Cocon",
    searchQuery: query,
    searchType: type,
    results: catalog.results.map(toSearchCard),
    unavailable: catalog.unavailable,
    canSearchDeeper: catalog.canSearchDeeper,
    people,
    minLength: MIN_LENGTH,
    layout: htmx ? false : undefined,
  });
});

export default router;

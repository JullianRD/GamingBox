"use strict";

import { fetchJson } from "../http.js";

/**
 * Anime et manga : AniList (API GraphQL publique, sans clé).
 * Identifiant externe : id AniList. L'id MyAnimeList (idMal) est gardé en métadonnée
 * pour les openings (Jikan) et les imports MyAnimeList.
 */

const API = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id idMal type format episodes chapters volumes
  title { romaji english native userPreferred }
  coverImage { large }
  startDate { year month day }
  genres
`;

const query = async (gql, variables) => {
  const data = await fetchJson("AniList", API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (data.errors?.length) throw new Error(`AniList : ${data.errors[0].message}`);
  return data.data;
};

const pad = (n) => String(n).padStart(2, "0");

export const anilistToItem = (media) => {
  const start = media.startDate ?? {};
  return {
    type: media.type === "MANGA" ? "manga" : "anime",
    source: "anilist",
    externalId: String(media.id),
    title: media.title?.userPreferred || media.title?.romaji || media.title?.english,
    releaseDate: start.year ? `${start.year}-${pad(start.month || 1)}-${pad(start.day || 1)}` : null,
    coverUrl: media.coverImage?.large ?? null,
    genres: (media.genres ?? []).slice(0, 3),
    metadata: {
      idMal: media.idMal ?? undefined,
      format: media.format ?? undefined,
      episodes: media.episodes ?? undefined,
      chapters: media.chapters ?? undefined,
      volumes: media.volumes ?? undefined,
      englishTitle: media.title?.english ?? undefined,
      nativeTitle: media.title?.native ?? undefined,
    },
  };
};

export const anilistCharacters = (media) =>
  (media.characters?.edges ?? []).map((edge) => ({
    kind: "character",
    externalId: String(edge.node.id),
    name: edge.node.name?.userPreferred || edge.node.name?.full,
    imageUrl: edge.node.image?.medium ?? null,
    role: edge.role === "MAIN" ? "Personnage principal" : edge.role === "SUPPORTING" ? "Personnage secondaire" : null,
  }));

const mediaType = (type) => (type === "manga" ? "MANGA" : "ANIME");

export default {
  source: "anilist",
  label: "AniList",
  types: ["anime", "manga"],
  configured: () => true,
  async search(search, { type } = {}) {
    const types = type ? [type] : ["anime", "manga"];
    const pages = await Promise.all(
      types.map((t) =>
        query(
          `query ($search: String, $type: MediaType) { Page(perPage: 8) { media(search: $search, type: $type, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} } } }`,
          { search, type: mediaType(t) },
        ),
      ),
    );
    return pages.flatMap((page) => page.Page.media.map(anilistToItem));
  },
  async match(title, { type = "anime" } = {}) {
    return this.search(title, { type });
  },
  async fetchItem(externalId) {
    const data = await query(`query ($id: Int) { Media(id: $id) { ${MEDIA_FIELDS} } }`, { id: Number(externalId) });
    return data.Media ? anilistToItem(data.Media) : null;
  },
  async fetchEntities(externalId) {
    const data = await query(
      `query ($id: Int) { Media(id: $id) { characters(sort: [ROLE, RELEVANCE], perPage: 12) { edges { role node { id name { userPreferred full } image { medium } } } } } }`,
      { id: Number(externalId) },
    );
    return data.Media ? anilistCharacters(data.Media) : [];
  },
  async similar(item) {
    const data = await query(
      `query ($id: Int) { Media(id: $id) { recommendations(sort: RATING_DESC, perPage: 10) { nodes { mediaRecommendation { ${MEDIA_FIELDS} } } } } }`,
      { id: Number(item.externalId) },
    );
    return (data.Media?.recommendations?.nodes ?? [])
      .map((node) => node.mediaRecommendation)
      .filter(Boolean)
      .map(anilistToItem);
  },
  async trending(type = "anime") {
    const data = await query(
      `query ($type: MediaType) { Page(perPage: 12) { media(type: $type, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} } } }`,
      { type: mediaType(type) },
    );
    return data.Page.media.map(anilistToItem);
  },
  // Correspondance d'ids MyAnimeList (imports) vers AniList, par lots de 50
  async findByMalIds(malIds, type = "anime") {
    const found = new Map();
    for (let i = 0; i < malIds.length; i += 50) {
      const chunk = malIds.slice(i, i + 50).map(Number);
      const data = await query(
        `query ($ids: [Int], $type: MediaType) { Page(perPage: 50) { media(idMal_in: $ids, type: $type) { ${MEDIA_FIELDS} } } }`,
        { ids: chunk, type: mediaType(type) },
      );
      for (const media of data.Page.media) found.set(String(media.idMal), anilistToItem(media));
    }
    return found;
  },
};

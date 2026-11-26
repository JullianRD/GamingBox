"use strict";

import { fetchJson } from "../http.js";

/**
 * Livres : Open Library (gratuite, sans clé). Une œuvre = un « work » (OL…W).
 */

const API = "https://openlibrary.org";
const cover = (id, size = "L") => (id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : null);
const workId = (key) => String(key ?? "").replace("/works/", "");

export const openLibraryToItem = (doc) => ({
  type: "book",
  source: "openlibrary",
  externalId: workId(doc.key),
  title: doc.title,
  releaseDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : null,
  coverUrl: cover(doc.cover_i ?? doc.cover_id),
  genres: (doc.subject ?? doc.subjects ?? []).slice(0, 3),
  metadata: { authors: doc.author_name ?? (doc.authors ?? []).map((a) => a.name).filter(Boolean) },
});

const search = async (params) => {
  const url = new URL(`${API}/search.json`);
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,subject");
  url.searchParams.set("limit", "10");
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const data = await fetchJson("Open Library", url);
  return data.docs.map(openLibraryToItem);
};

export default {
  source: "openlibrary",
  label: "Open Library",
  types: ["book"],
  configured: () => true,
  async search(query) {
    return search({ q: query });
  },
  async match(title, { author } = {}) {
    return search({ title, author });
  },
  async fetchItem(externalId) {
    if (!/^OL\d+W$/.test(externalId)) return null;
    const work = await fetchJson("Open Library", `${API}/works/${externalId}.json`);
    const authorKeys = (work.authors ?? []).map((a) => a.author?.key).filter(Boolean).slice(0, 2);
    const authors = await Promise.all(
      authorKeys.map((key) => fetchJson("Open Library", `${API}${key}.json`).then((a) => a.name).catch(() => null)),
    );
    const description = typeof work.description === "string" ? work.description : work.description?.value;
    return {
      type: "book",
      source: "openlibrary",
      externalId,
      title: work.title,
      releaseDate: null,
      coverUrl: cover(work.covers?.[0]),
      genres: (work.subjects ?? []).slice(0, 3),
      metadata: { authors: authors.filter(Boolean), overview: description?.slice(0, 1000) },
    };
  },
  // ISBN (imports Goodreads) -> œuvre
  async findByIsbn(isbn) {
    const edition = await fetchJson("Open Library", `${API}/isbn/${isbn}.json`).catch(() => null);
    const key = edition?.works?.[0]?.key;
    return key ? this.fetchItem(workId(key)) : null;
  },
  async similar(item) {
    const subject = item.genres?.[0];
    if (!subject) return [];
    const results = await search({ subject, sort: "rating" });
    return results.filter((r) => r.externalId !== item.externalId);
  },
  async trending() {
    const data = await fetchJson("Open Library", `${API}/trending/weekly.json?limit=12`);
    return (data.works ?? []).map(openLibraryToItem);
  },
};

"use strict";

import { fetchJson } from "../http.js";

/**
 * Musique : Deezer (API publique, sans clé). Une œuvre = un album.
 * Deezer fournit aussi les extraits de 30 secondes utilisés par le blindtest.
 */

const API = "https://api.deezer.com";

export const deezerToItem = (album) => ({
  type: "music",
  source: "deezer",
  externalId: String(album.id),
  title: album.title,
  releaseDate: album.release_date || null,
  coverUrl: album.cover_xl || album.cover_big || album.cover_medium || null,
  genres: (album.genres?.data ?? []).map((g) => g.name).slice(0, 3),
  metadata: { artist: album.artist?.name, tracks: album.nb_tracks ?? undefined },
});

export const deezerTrack = (track) => ({
  id: String(track.id),
  title: track.title_short || track.title,
  artist: track.artist?.name,
  preview: track.preview || null,
  cover: track.album?.cover_medium ?? null,
});

const get = (path, params = {}) => {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return fetchJson("Deezer", url);
};

export default {
  source: "deezer",
  label: "Deezer",
  types: ["music"],
  configured: () => true,
  async search(query) {
    const data = await get("/search/album", { q: query, limit: 10 });
    return (data.data ?? []).map(deezerToItem);
  },
  async match(title, { artist } = {}) {
    const q = artist ? `artist:"${artist}" album:"${title}"` : title;
    const data = await get("/search/album", { q, limit: 5 });
    return (data.data ?? []).map(deezerToItem);
  },
  async fetchItem(externalId) {
    if (!/^\d+$/.test(externalId)) return null;
    const album = await get(`/album/${externalId}`);
    return album.error ? null : deezerToItem(album);
  },
  // Albums des artistes proches de celui de l'album
  async similar(item) {
    const album = await get(`/album/${item.externalId}`);
    const artistId = album.artist?.id;
    if (!artistId) return [];
    const related = await get(`/artist/${artistId}/related`, { limit: 6 });
    const albums = await Promise.all(
      (related.data ?? []).map((artist) =>
        get(`/artist/${artist.id}/albums`, { limit: 1 }).then((r) => r.data?.[0] && { ...r.data[0], artist }).catch(() => null),
      ),
    );
    return albums.filter(Boolean).map(deezerToItem);
  },
  async trending() {
    const data = await get("/chart/0/albums", { limit: 12 });
    return (data.data ?? []).map(deezerToItem);
  },
  // Extraits audio (blindtest)
  async searchTracks(query, limit = 5) {
    const data = await get("/search/track", { q: query, limit });
    return (data.data ?? []).map(deezerTrack).filter((t) => t.preview);
  },
  async chartTracks(limit = 50) {
    const data = await get("/chart/0/tracks", { limit });
    return (data.data ?? []).map(deezerTrack).filter((t) => t.preview);
  },
  async albumTracks(externalId) {
    const data = await get(`/album/${externalId}/tracks`, { limit: 50 });
    return (data.data ?? []).map(deezerTrack).filter((t) => t.preview);
  },
};

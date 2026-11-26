"use strict";

import db from "../../config/database.js";

// Date SQL (objet Date en heure locale) vers « AAAA-MM-JJ »
const toDateString = (value) => {
  if (!value) return null;
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

// Caractères spéciaux de LIKE échappés
const likeEscape = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

// Lignes SQL vers objets JS
export const toItem = (row) =>
  row
    ? {
        id: row.id_item,
        type: row.item_type,
        source: row.source,
        externalId: row.external_id,
        title: row.title,
        releaseDate: toDateString(row.release_date),
        fetchedAt: row.fetched_at ?? null,
        coverUrl: row.cover_url,
        genres: row.genres ?? [],
        metadata: row.metadata ?? {},
      }
    : null;

export const toEntity = (row) => ({
  id: row.id_entity,
  kind: row.entity_kind,
  name: row.name,
  imageUrl: row.image_url,
  role: row.role ?? null,
  metadata: row.metadata ?? {},
  isFavorite: Boolean(row.is_favorite),
});

class ItemRepository {
  static async findById(itemId) {
    const { rows } = await db.query(`SELECT * FROM items WHERE id_item = $1`, [itemId]);
    return toItem(rows[0]);
  }

  static async findBySource(source, externalId) {
    const { rows } = await db.query(`SELECT * FROM items WHERE source = $1 AND external_id = $2`, [
      source,
      String(externalId),
    ]);
    return toItem(rows[0]);
  }

  // Crée l'œuvre ou rafraîchit ses infos si elle existe déjà
  // fresh : la description vient d'être lue chez la source (sinon fetched_at ne bouge pas)
  static async upsert(item, { fresh = true } = {}) {
    const { rows } = await db.query(
      `
        INSERT INTO items (item_type, source, external_id, title, release_date, cover_url, genres, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (source, external_id) DO UPDATE SET
          title = EXCLUDED.title,
          release_date = COALESCE(EXCLUDED.release_date, items.release_date),
          cover_url = COALESCE(EXCLUDED.cover_url, items.cover_url),
          genres = CASE WHEN cardinality(EXCLUDED.genres) > 0 THEN EXCLUDED.genres ELSE items.genres END,
          metadata = items.metadata || EXCLUDED.metadata,
          fetched_at = CASE WHEN $9::boolean THEN NOW() ELSE items.fetched_at END
        RETURNING *
      `,
      [
        item.type,
        item.source,
        String(item.externalId),
        item.title,
        item.releaseDate || null,
        item.coverUrl || null,
        item.genres ?? [],
        item.metadata ?? {},
        fresh,
      ],
    );
    return toItem(rows[0]);
  }

  // Enregistre une liste d'œuvres venues d'une API ; renvoie les lignes en base, dans le même ordre
  static async upsertMany(items, options) {
    const saved = [];
    for (const item of items) saved.push(await ItemRepository.upsert(item, options));
    return saved;
  }

  static async findByIds(ids) {
    if (!ids?.length) return [];
    const { rows } = await db.query(`SELECT * FROM items WHERE id_item = ANY($1::uuid[])`, [ids]);
    const byId = new Map(rows.map((row) => [row.id_item, toItem(row)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  /**
   * Recherche dans notre catalogue : titre qui contient la requête, ou proche
   * (trigrammes, index idx_items_title_trgm). Les titres exacts passent devant.
   */
  static async searchLocal(query, { type = null, limit = 30 } = {}) {
    const text = String(query).trim().slice(0, 200);
    if (text.length < 2) return [];
    const { rows } = await db.query(
      `
        SELECT * FROM items
        WHERE parent_item_id IS NULL
          AND ($2::item_type_enum IS NULL OR item_type = $2)
          AND (title ILIKE '%' || $1 || '%' OR title % $3)
        ORDER BY (title = $3) DESC, similarity(title::text, $3) DESC, created_at
        LIMIT $4
      `,
      [likeEscape(text), type, text, limit],
    );
    return rows.map(toItem);
  }

  // Rattache des entités (personnages...) à une œuvre, en une transaction
  static async replaceEntities(itemId, source, entities) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const [position, entity] of entities.entries()) {
        const { rows } = await client.query(
          `
            INSERT INTO entities (entity_kind, source, external_id, name, image_url, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (source, entity_kind, external_id) DO UPDATE SET
              name = EXCLUDED.name,
              image_url = EXCLUDED.image_url,
              metadata = EXCLUDED.metadata
            RETURNING id_entity
          `,
          [entity.kind, entity.source ?? source, entity.externalId, entity.name, entity.imageUrl, entity.metadata ?? {}],
        );
        await client.query(
          `
            INSERT INTO item_entities (item_id, entity_id, role, position)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (item_id, entity_id) DO UPDATE SET role = EXCLUDED.role, position = EXCLUDED.position
          `,
          [itemId, rows[0].id_entity, entity.role ?? null, position],
        );
      }
      await client.query(
        `UPDATE items SET metadata = metadata || jsonb_build_object('entitiesFetchedAt', now()) WHERE id_item = $1`,
        [itemId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Entités d'une œuvre, avec le favori de l'utilisateur
  static async findEntities(itemId, userId) {
    const { rows } = await db.query(
      `
        SELECT e.*, ie.role, (f.entity_id IS NOT NULL) AS is_favorite
        FROM item_entities ie
        JOIN entities e ON e.id_entity = ie.entity_id
        LEFT JOIN user_favorite_entities f ON f.entity_id = e.id_entity AND f.user_id = $2
        WHERE ie.item_id = $1
        ORDER BY ie.position, e.name
      `,
      [itemId, userId],
    );
    return rows.map(toEntity);
  }

  static async findEntityForItem(entityId, itemId) {
    const { rows } = await db.query(
      `
        SELECT e.*, ie.role
        FROM item_entities ie JOIN entities e ON e.id_entity = ie.entity_id
        WHERE ie.entity_id = $1 AND ie.item_id = $2
      `,
      [entityId, itemId],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  // Bascule un favori ; renvoie le nouvel état
  static async toggleFavoriteEntity(userId, entityId, itemId) {
    const removed = await db.query(
      `DELETE FROM user_favorite_entities WHERE user_id = $1 AND entity_id = $2`,
      [userId, entityId],
    );
    if (removed.rowCount) return false;
    await db.query(`INSERT INTO user_favorite_entities (user_id, entity_id, item_id) VALUES ($1, $2, $3)`, [
      userId,
      entityId,
      itemId,
    ]);
    return true;
  }

  static async findFavoriteEntities(userId) {
    const { rows } = await db.query(
      `
        SELECT e.*, true AS is_favorite, i.title AS item_title, i.item_type
        FROM user_favorite_entities f
        JOIN entities e ON e.id_entity = f.entity_id
        LEFT JOIN items i ON i.id_item = f.item_id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
      `,
      [userId],
    );
    return rows.map((row) => ({ ...toEntity(row), itemTitle: row.item_title, itemType: row.item_type }));
  }
}

export default ItemRepository;

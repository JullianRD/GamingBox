"use strict";

import db from "../../config/database.js";

// Lignes SQL vers objets JS
export const toItem = (row) =>
  row
    ? {
        id: row.id_item,
        type: row.item_type,
        source: row.source,
        externalId: row.external_id,
        title: row.title,
        releaseDate: row.release_date,
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
  static async upsert(item) {
    const { rows } = await db.query(
      `
        INSERT INTO items (item_type, source, external_id, title, release_date, cover_url, genres, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (source, external_id) DO UPDATE SET
          title = EXCLUDED.title,
          release_date = EXCLUDED.release_date,
          cover_url = EXCLUDED.cover_url,
          genres = EXCLUDED.genres,
          metadata = items.metadata || EXCLUDED.metadata
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
      ],
    );
    return toItem(rows[0]);
  }

  // Rattache des entités (personnages...) à une œuvre, en une transaction
  static async replaceEntities(itemId, source, entities) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const [position, entity] of entities.entries()) {
        const { rows } = await client.query(
          `
            INSERT INTO entities (entity_kind, source, external_id, name, image_url)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (source, entity_kind, external_id) DO UPDATE SET
              name = EXCLUDED.name,
              image_url = EXCLUDED.image_url
            RETURNING id_entity
          `,
          [entity.kind, source, entity.externalId, entity.name, entity.imageUrl],
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

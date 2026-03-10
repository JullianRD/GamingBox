"use strict"

import db from "../config/database.js"

// ReviewTagRepository : Table pivot pour gérer la relation many to many des reviews avec les tags

class ReviewTagRepository {
    
    // Ajouter un tag à une review 

    static async add(reviewId, tagId) {
        const query = /*SQL*/ `
        INSERT INTO review_tags (review_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT (review_id, tag_id) DO NOTHING
        RETURNING review_id, tag_id;
        `;

        const { rows } = await db.query(query, [reviewId, tagId]);
        return rows[0] ? new ItemTagEntity(rows[0]) : null;
    }

    // Supprimer un tag d'une review

    static async remove(reviewId, tagId) {
        const result = await db.query(
            /*SQL*/ `
            DELETE FROM review_tags
            WHERE review_id = $1 
            AND tag_id = $2;
            `,
            [reviewId, tagId]
        );
        return result.rowCount > 0;
    }

    // Remplace complétement les tags d'une review

    static async sync(reviewId, tagIds = []) {
        await db.query("BEGIN");

    try {
        await db.query(
            /*SQL*/ `DELETE FROM item_tags 
            WHERE item_id = $1;`, [itemId]);

        if (tagIds.length > 0) {
        const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(", ");

        await db.query(
            /*SQL*/ `INSERT INTO item_tags (item_id, tag_id) 
            VALUES ${values};`,
            [itemId, ...tagIds],
        );
        }

        await db.query("COMMIT");
    } catch (error) {
        await db.query("ROLLBACK");
        throw error;
    }
    }
}

export default ReviewTagRepository;
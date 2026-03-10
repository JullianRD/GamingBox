"use strict"

import db from "../config/database.js"
import Game from "../entities/Game.js"

class GameRepository {

    // Obtenir la liste de tout les jeux présent en base local
    static async findAllByGameId(gameId) {
        const query = /*SQL*/ `
        SELECT *
        FROM games
        WHERE game_id = $1
        ORDER BY created_at DESC;
        `;

        const { rows } = await db.query(query, [gameId]);
        if (rows.length === 0) return null;
        return rows.map((row) => new Game(row)); // Retourne une entities Game
    }

    // Retourne un jeu par son identifiant
    static async findById(id) {
        const query = /*SQL*/ `
        SELECT
        id_game,
        igdb_id,
        game_title,
        game_genre,
        release_date,
        thumbnail_url,
        created_at,
        updated_at
        FROM games
        WHERE id_game = $1
        `;

        const { rows } = await db.query(query, [id]);
        return rows[0] ? new Game(rows[0]) : null;
    }

    // Créer le jeu dans la base de données local
    static async create(data) {
        const query = /*SQL*/ `
        INSERT INTO games (
        game_title,
        game_genre,
        release_date,
        thumbnail_url
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING 
        id_game,
        igdb_id,
        game_title,
        game_genre,
        release_date
        thumbnail_url,
        created_at,
        updated_at;
        `;

        const values = [
            data.gameTitle,
            data.gameGenre,
            data.releaseDate,
            data.thumbnailUrl.trim(),
        ];

        const { rows } = await db.query(query, values);
        return new Game(rows[0]);
    }


    // Mettre à jour les infos du jeu en base local
    static async update(id, data) {
        const query = /*SQL*/ `
        UPDATE games
        SET
        game_title = COALESCE($1, game_title),
        game_genre = COALESCE($2, game_genre),
        release_date = COALESCE($3, release_date),
        thumbnail_url = COALESCE($4, thumbnail_url),
        updated_at = NOW()
        WHERE id_game = $5
        RETURNING
        id_game,
        igdb_id,
        game_title,
        game_genre,
        release_date,
        thumbnail_url,
        created_at,
        updated_at
        `;

        const values = [
            data.gameTitle,
            data.gameGenre,
            data.releaseDate,
            data.thumbnailUrl.trim(),
            id,
        ];

        const { rows } = await db.query(query, values);
        return rows[0] ? new Game(rows[0]) : null;
    }

    // Supprimer un jeu de la base de données
    static async delete(id) {
        const result = await db.query(
            /*SQL*/ `
            DELETE FROM games
            WHERE id_game = $1;`,
            [id,]
        );
        return result.rowCount > 0;
    }
}

export default GameRepository;
"use strict";

import db from "../config/database.js";
import Game from "../entities/Game.js";
import Review from "../entities/Review.js";

class GameRepository {
  // Obtenir la liste de tout les jeux présent en base local
  static async findAllByGameId() {
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
      ORDER BY game_title ASC
    `;

    const { rows } = await db.query(query);
    return rows.map((row) => new Game(row));
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

  // Retourne un jeu par son identifiant IGDB
  static async findByIgdbId(igdbId) {
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
      WHERE igdb_id = $1
      LIMIT 1
    `;

    const { rows } = await db.query(query, [igdbId]);
    return rows[0] ? new Game(rows[0]) : null;
  }

  // Afficher toutes les reviews d'un jeu
  static async findReviewsByGameId(gameId) {
    const query = /*SQL*/ `
      SELECT *
      FROM v_reviews_with_game
      WHERE game_id = $1
      ORDER BY created_at DESC
    `;

    const values = [gameId];
    const { rows } = await db.query(query, values);

    return rows.map((row) => new Review(row));
  }

  // Créer le jeu dans la base de données local
  static async create(data) {
    const query = /*SQL*/ `
      INSERT INTO games (
        igdb_id,
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
        release_date,
        thumbnail_url,
        created_at,
        updated_at;
    `;

    const values = [
      data.igdbId,
      data.gameTitle,
      data.gameGenre,
      data.releaseDate || null,
      data.thumbnailUrl ? data.thumbnailUrl.trim() : null,
    ];

    try {
      const { rows } = await db.query(query, values);
      return new Game(rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        const existingGame = await this.findByIgdbId(data.igdbId);
        if (existingGame) {
          return existingGame;
        }
      }
      throw error;
    }
  }

  // Mettre à jour les infos du jeu en base local
  static async update(id, data) {
    const query = /*SQL*/ `
      UPDATE games
      SET
        igdb_id = COALESCE($1, igdb_id),
        game_title = COALESCE($2, game_title),
        game_genre = COALESCE($3, game_genre),
        release_date = COALESCE($4, release_date),
        thumbnail_url = COALESCE($5, thumbnail_url),
        updated_at = NOW()
      WHERE id_game = $6
      RETURNING
        id_game,
        igdb_id,
        game_title,
        game_genre,
        release_date,
        thumbnail_url,
        created_at,
        updated_at;
    `;

    const values = [
      data.igdbId,
      data.gameTitle,
      data.gameGenre,
      data.releaseDate,
      data.thumbnailUrl ? data.thumbnailUrl.trim() : null,
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
        WHERE id_game = $1;
      `,
      [id],
    );
    return result.rowCount > 0;
  }
}

export default GameRepository;
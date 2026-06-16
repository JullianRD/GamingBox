"use strict";
/**
 * @fileoverview Modèle de données pour les jeux (API IGDB)
 */

/**
 * @class Game
 * @description Représente un jeu stocké dans la base de données (ou via l'API de IGDB)
 */
class Game {
  constructor(data) {
    this.id = data.id_game;
    this.igdbId = data.igdb_id;
    this.gameTitle = data.game_title;
    this.gameGenre = data.game_genre;
    this.releaseDate = data.release_date;
    this.thumbnailUrl = data.thumbnail_url;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * Crée une entité depuis une ligne PostgreSQL
   */
  static fromDatabase(row) {
    return row ? new Game(row) : null;
  }

  /**
   * Crée une liste d'entités depuis des lignes PostgreSQL
   */
  static fromDatabaseList(rows) {
    return rows.map((row) => new Game(row));
  }

  toJSON() {
    return {
      id: this.id,
      igdbId: this.igdbId,
      gameTitle: this.gameTitle,
      gameGenre: this.gameGenre,
      releaseDate: this.releaseDate,
      thumbnailUrl: this.thumbnailUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convertit l'objet Game en chaîne de caractères JSON
   * @returns {string} - Chaîne de caractères JSON représentant l'objet Game
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export default Game;
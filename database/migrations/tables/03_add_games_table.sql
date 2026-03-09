-- Relation Merise : reviews (1,1) --- (0,N) games (un review appartient à un utilisateur)
-- ============================================================================

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

CREATE TABLE IF NOT EXISTS games (
    id_game UUID DEFAULT uuidV7() PRIMARY KEY,
    igdb_id INTEGER NOT NULL UNIQUE REFERENCES igdb (id_igdb) ON DELETE CASCADE, -- API IGDB pour importer les jeux et certaines infos
    game_title VARCHAR(100) NOT NULL,
    game_genre VARCHAR(50) NOT NULL,
    release_date DATE NOT NULL,
    thumbnail_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE games IS 'L endroit ou l on stocke les jeux en local, si un jeu n est pas présent on fait un appel à l API IGDB pour l intégrer'
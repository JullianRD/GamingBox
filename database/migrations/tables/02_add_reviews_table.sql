-- Relation Merise : users (0,N) (un utilisateur peut ou non créer une à plusieurs reviews) --- (1,1) reviews (une review appartient à un utilisateur)
-- ============================================================================

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

CREATE TABLE IF NOT EXISTS reviews (
    id_review UUID DEFAULT uuid_v7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games (id_game) ON DELETE CASCADE,
    game_title VARCHAR(100) NOT NULL,
    slug CITEXT NOT NULL,
    release_date DATE NOT NULL,
    game_genre VARCHAR(50) NOT NULL,
    thumbnail_url VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}', -- Recherche puissante ici
    review_date DECIMAL(15,2) NOT NULL,
    review_like BOOLEAN NOT NULL DEFAULT FALSE,
    review_platine BOOLEAN NOT NULL DEFAULT FALSE,
    progression_status progression_status_enum NOT NULL,
    avis_review CITEXT,
    game_platforme game_platforme_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_user_review_title UNIQUE (user_id, game_title), -- Un utilisateur ne peux pas créer deux reviews sur le même jeu
    CONSTRAINT unique_user_review_slug UNIQUE (user_id, slug)    -- Le slug doit être unique par utilisateur
);

-- Index GIN pour recherche floue sur le titre (Trigram)
CREATE INDEX idx_reviews_title_trgm ON reviews USING gin (title gin_trgm_ops);

-- Index GIN pour recherche dans les métadonnées JSONB
CREATE INDEX idx_reviews_metadata ON reviews USING gin (metadata);

-- Index pour recherche par utilisateur (requête la plus fréquente)
CREATE INDEX idx_reviews_user ON reviews (user_id);

COMMENT ON TABLE reviews IS 'L utilisateur va pouvoir faire ses review de jeu ici';
COMMENT ON COLUMN reviews.slug IS 'Version URL-friendly du titre pour le SEO et les routes';
COMMENT ON COLUMN reviews.thumbnail_url IS 'URL de l image stockée sur service externe (Cloudinary/Supabase)';
COMMENT ON COLUMN reviews.metadata IS 'Métadonnées flexibles en JSONB : {"isbn": "xxx", source_url": "xxx", "duration": "45min", "channel": "xxx", "coordinates": {...}}';


-- Application du trigger
CREATE TRIGGER set_timestamp_reviews BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
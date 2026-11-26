-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Modèle générique Cocon : une œuvre (items), ce que l'utilisateur
-- en fait (user_items), ses listes perso et ses favoris.
-- Les anciennes tables games / reviews restent jusqu'à l'étape Social,
-- qui refait les partages et l'admin sur ce modèle.
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE item_type_enum AS ENUM (
    'game', 'movie', 'series', 'book', 'anime', 'manga', 'music'
);
COMMENT ON TYPE item_type_enum IS 'Catégorie d une œuvre suivie dans Cocon';

CREATE TYPE entry_status_enum AS ENUM (
    'planned', 'in_progress', 'completed', 'paused', 'dropped'
);
COMMENT ON TYPE entry_status_enum IS 'Statut d une œuvre dans la bibliothèque d un utilisateur';

CREATE TYPE entity_kind_enum AS ENUM (
    'character', 'song', 'person'
);
COMMENT ON TYPE entity_kind_enum IS 'Sous-élément d une œuvre (personnage, opening, auteur...)';

-- Catalogue partagé entre utilisateurs, alimenté par les API (IGDB, TMDB...)
CREATE TABLE items (
    id_item UUID DEFAULT uuidv7() PRIMARY KEY,
    item_type item_type_enum NOT NULL,
    source VARCHAR(20) NOT NULL,                -- igdb, tmdb, anilist, openlibrary, manual...
    external_id VARCHAR(64) NOT NULL,           -- identifiant chez la source
    title CITEXT NOT NULL,
    release_date DATE,
    cover_url VARCHAR(500),
    genres TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',       -- champs propres au type (durée, plateformes, auteur...)
    parent_item_id UUID REFERENCES items (id_item) ON DELETE CASCADE, -- tome d une série, saison...
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_item_source UNIQUE (source, external_id)
);
CREATE INDEX idx_items_type ON items (item_type);
CREATE INDEX idx_items_title_trgm ON items USING gin (title gin_trgm_ops);
CREATE INDEX idx_items_parent ON items (parent_item_id) WHERE parent_item_id IS NOT NULL;
COMMENT ON TABLE items IS 'Catalogue des œuvres (jeux, films, séries...), une ligne par œuvre et par source';
CREATE TRIGGER set_timestamp_items BEFORE UPDATE ON items FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Bibliothèque : une entrée de liste par utilisateur et par œuvre
CREATE TABLE user_items (
    id_user_item UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items (id_item) ON DELETE CASCADE,
    status entry_status_enum NOT NULL DEFAULT 'planned',
    rating SMALLINT CHECK (rating BETWEEN 1 AND 10), -- sur 10, affiché en demi-étoiles sur 5
    review TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    started_at DATE,
    finished_at DATE,
    metadata JSONB NOT NULL DEFAULT '{}',       -- plateforme, progression, source d import...
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);
CREATE INDEX idx_user_items_user_status ON user_items (user_id, status);
CREATE INDEX idx_user_items_favorite ON user_items (user_id) WHERE is_favorite;
COMMENT ON TABLE user_items IS 'Entrées de liste : statut, note, avis et favori d un utilisateur sur une œuvre';
CREATE TRIGGER set_timestamp_user_items BEFORE UPDATE ON user_items FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Tags (table tags existante) posés sur les entrées
CREATE TABLE user_item_tags (
    user_item_id UUID NOT NULL REFERENCES user_items (id_user_item) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags (id_tag) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_item_id, tag_id)
);
CREATE INDEX idx_user_item_tags_tag ON user_item_tags (tag_id);

-- Listes perso (« Mes jeux préférés », « Top 10 séries »)
CREATE TABLE lists (
    id_list UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    slug CITEXT NOT NULL,
    description TEXT,
    item_type item_type_enum,                   -- NULL = liste multi-catégories
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_user_list_slug UNIQUE (user_id, slug)
);
CREATE INDEX idx_lists_user ON lists (user_id);
CREATE TRIGGER set_timestamp_lists BEFORE UPDATE ON lists FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE list_items (
    list_id UUID NOT NULL REFERENCES lists (id_list) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items (id_item) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, item_id)
);
CREATE INDEX idx_list_items_position ON list_items (list_id, position);

-- Sous-éléments des œuvres : personnages, openings, auteurs
CREATE TABLE entities (
    id_entity UUID DEFAULT uuidv7() PRIMARY KEY,
    entity_kind entity_kind_enum NOT NULL,
    source VARCHAR(20) NOT NULL,
    external_id VARCHAR(64) NOT NULL,
    name CITEXT NOT NULL,
    image_url VARCHAR(500),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_entity_source UNIQUE (source, entity_kind, external_id)
);
CREATE TRIGGER set_timestamp_entities BEFORE UPDATE ON entities FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE item_entities (
    item_id UUID NOT NULL REFERENCES items (id_item) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities (id_entity) ON DELETE CASCADE,
    role VARCHAR(100),                          -- « Opening 1 », « Personnage principal »...
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, entity_id)
);
CREATE INDEX idx_item_entities_entity ON item_entities (entity_id);

-- Favoris sur les sous-éléments (personnages préférés, openings préférés)
CREATE TABLE user_favorite_entities (
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities (id_entity) ON DELETE CASCADE,
    item_id UUID REFERENCES items (id_item) ON DELETE SET NULL, -- œuvre depuis laquelle le favori a été ajouté
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, entity_id)
);

-- Down Migration

DROP TABLE IF EXISTS user_favorite_entities;
DROP TABLE IF EXISTS item_entities;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS list_items;
DROP TABLE IF EXISTS lists;
DROP TABLE IF EXISTS user_item_tags;
DROP TABLE IF EXISTS user_items;
DROP TABLE IF EXISTS items;
DROP TYPE IF EXISTS entity_kind_enum;
DROP TYPE IF EXISTS entry_status_enum;
DROP TYPE IF EXISTS item_type_enum;

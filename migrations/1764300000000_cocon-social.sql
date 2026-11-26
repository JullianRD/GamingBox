-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Social Cocon : profils publics, abonnements, fil d'activité,
-- commentaires et recommandations entre utilisateurs.
-- Retire aussi les tables héritées de GamingBox (jeux, reviews, partages),
-- remplacées par le modèle générique (items, user_items, lists).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN users.is_public IS 'Profil, listes publiques et activité visibles par les autres utilisateurs';

-- Abonnements ; deux abonnements réciproques font des amis
CREATE TABLE follows (
    follower_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    CONSTRAINT no_self_follow CHECK (follower_id <> followed_id)
);
CREATE INDEX idx_follows_followed ON follows (followed_id);

CREATE TYPE activity_kind_enum AS ENUM (
    'added', 'status', 'rated', 'reviewed', 'favorited', 'listed', 'commented', 'recommended', 'followed'
);

-- Fil d'activité (et base des tendances)
CREATE TABLE activities (
    id_activity UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    kind activity_kind_enum NOT NULL,
    user_item_id UUID REFERENCES user_items (id_user_item) ON DELETE CASCADE,
    item_id UUID REFERENCES items (id_item) ON DELETE CASCADE,
    list_id UUID REFERENCES lists (id_list) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users (id_user) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_activities_user_date ON activities (user_id, created_at DESC);
CREATE INDEX idx_activities_item_date ON activities (item_id, created_at DESC);
CREATE INDEX idx_activities_kind_date ON activities (kind, created_at DESC);

-- Commentaires sous les entrées de liste
CREATE TABLE entry_comments (
    id_comment UUID DEFAULT uuidv7() PRIMARY KEY,
    user_item_id UUID NOT NULL REFERENCES user_items (id_user_item) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_entry_comments_entry ON entry_comments (user_item_id, created_at);

-- Recommandation d'une œuvre à un ami, avec un mot
CREATE TABLE recommendations (
    id_recommendation UUID DEFAULT uuidv7() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items (id_item) ON DELETE CASCADE,
    message TEXT CHECK (char_length(message) <= 500),
    seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_recommendation UNIQUE (sender_id, recipient_id, item_id),
    CONSTRAINT no_self_recommendation CHECK (sender_id <> recipient_id)
);
CREATE INDEX idx_recommendations_recipient ON recommendations (recipient_id, created_at DESC);

CREATE INDEX idx_users_pseudo_trgm ON users USING gin (pseudo gin_trgm_ops);

-- Tables héritées de GamingBox
DROP TABLE IF EXISTS review_tags CASCADE;
DROP TABLE IF EXISTS shares CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TYPE IF EXISTS progression_status_enum;
DROP TYPE IF EXISTS game_platforme_enum;

-- Down Migration

-- Recrée les tables héritées (sans leurs vues de lecture, qui ne servent plus)
CREATE TYPE progression_status_enum AS ENUM(
    'En cour',
    'Terminé',
    'Whislist',
    'Dropped'
);

COMMENT ON TYPE progression_status_enum IS 'Status du jeu ajouté dans la review par l utilisateur';

CREATE TYPE game_platforme_enum AS ENUM(
    'PC',
    'Console de jeu',
    'Autre'
);

COMMENT ON TYPE game_platforme_enum IS 'Platforme de jeu sur laquelle le joueur à joué pour le jeu de sa review';


CREATE TABLE IF NOT EXISTS games (
    id_game UUID DEFAULT uuidV7() PRIMARY KEY,
    igdb_id BIGINT UNIQUE NOT NULL, -- API IGDB pour importer les jeux et certaines infos
    game_title VARCHAR(100) NOT NULL,
    game_genre VARCHAR(50) NOT NULL,
    release_date DATE NOT NULL,
    thumbnail_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE games IS 'L endroit ou l on stocke les jeux en local, si un jeu n est pas présent on fait un appel à l API IGDB pour l intégrer';

COMMENT ON COLUMN games.thumbnail_url IS 'URL de l image stockée sur service externe (Cloudinary/Supabase)';


-- >>> 03_add_reviews_table.sql
-- Relation Merise : users (0,N) (un utilisateur peut ou non créer une à plusieurs reviews) --- (1,1) reviews (une review appartient à un utilisateur)
-- ============================================================================

-- Forcer l'encodage client

CREATE TABLE IF NOT EXISTS reviews (
    id_review UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games (id_game) ON DELETE CASCADE,
    review_title VARCHAR(100) NOT NULL, -- Titre de la review que l'utilisateur peut donner
    slug CITEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}', -- Recherche puissante ici
    review_rate DECIMAL(15,2) NOT NULL,
    review_like BOOLEAN NOT NULL DEFAULT FALSE,
    review_platine BOOLEAN NOT NULL DEFAULT FALSE,
    progression_status progression_status_enum NOT NULL DEFAULT 'En cour',
    avis_review CITEXT,
    game_platforme game_platforme_enum NOT NULL DEFAULT 'Autre',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_user_game UNIQUE (user_id, game_id), -- Un utilisateur ne peux pas créer deux reviews sur le même jeu
    CONSTRAINT unique_user_review_slug UNIQUE (user_id, slug)    -- Le slug doit être unique par utilisateur
);

-- Index GIN pour recherche floue sur le titre (Trigram)
CREATE INDEX idx_reviews_title_trgm ON reviews USING gin (review_title gin_trgm_ops);

-- Index GIN pour recherche dans les métadonnées JSONB
CREATE INDEX idx_reviews_metadata ON reviews USING gin (metadata);

-- Index pour recherche par utilisateur (requête la plus fréquente)
CREATE INDEX idx_reviews_user ON reviews (user_id);

COMMENT ON TABLE reviews IS 'L utilisateur va pouvoir faire ses review de jeu ici';
COMMENT ON COLUMN reviews.slug IS 'Version URL-friendly du titre pour le SEO et les routes';
COMMENT ON COLUMN reviews.metadata IS 'Métadonnées flexibles en JSONB : {"isbn": "xxx", source_url": "xxx", "duration": "45min", "channel": "xxx", "coordinates": {...}}';


-- Application du trigger
CREATE TRIGGER set_timestamp_reviews BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- >>> 04_add_tags_table.sql
-- Relation Merise : users (0,N) --- (1,1) tags (un tag appartient à un utilisateur)
-- ============================================================================

-- Forcer l'encodage client


CREATE TABLE IF NOT EXISTS shares (
    id_share UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews (id_review) ON DELETE SET NULL, -- Null autorisé et ON DELETE SET NULL pour conserver un historique (audit de sécurité)
    recipient_email CITEXT NOT NULL,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    access_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
); 

-- Index pour recherche par utilisateur (liste des partages d'un user)
CREATE INDEX idx_shares_user ON shares (user_id);

--Index pour recherche par review (liste des partages d'une review)
CREATE INDEX idx_shares_review ON shares (review_id);

-- Documentation
COMMENT ON TABLE shares IS 'Gère les partages temporaires ou permanents des utilisateurs ou des pépites via un token unique';
COMMENT ON COLUMN shares.recipient_email IS 'Email de l invité';
COMMENT ON COLUMN shares.share_token IS 'Token sécurisé généré côté backend (crypto.randomBytes)';
COMMENT ON COLUMN shares.access_config IS 'Configuration flexible du partage :
{
  "level": "read",
  "allow_download": false,
  "expiration": "2026-01-31T23:59:59Z",
  "password": "$2b$10$hash...",
  "max_views": 10,
  "view_count": 0
}';

-- Application du trigger
CREATE TRIGGER set_timestamp_shares BEFORE UPDATE ON shares FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- >>> 06_add_app_events_table.sql
-- Relation Merise : events (0,1) --- (1,N) users (Un événement peut être lié à 0 ou 1 utilisateur)
-- ============================================================================

-- Forcer l'encodage client



CREATE TABLE IF NOT EXISTS review_tags (
    id_tag UUID REFERENCES tags (id_tag) ON DELETE CASCADE,
    id_review UUID REFERENCES reviews (id_review) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_tag, id_review)
);

CREATE INDEX idx_review_tags_tag ON review_tags (id_tag);

COMMENT ON TABLE review_tags IS 'Table de liaison gérant la relation Many-to-Many entre Reviews et Tags';
-- Application du trigger



DROP INDEX IF EXISTS idx_users_pseudo_trgm;
DROP TABLE IF EXISTS recommendations;
DROP TABLE IF EXISTS entry_comments;
DROP TABLE IF EXISTS activities;
DROP TYPE IF EXISTS activity_kind_enum;
DROP TABLE IF EXISTS follows;
ALTER TABLE users DROP COLUMN IF EXISTS is_public;

-- Up Migration
-- Schéma GamingBox existant, regroupé en une seule migration de départ.
-- Source : anciens fichiers database/migrations/{config,tables}, database/triggers et database/vues.

-- >>> 03_add_extensions.sql
-- ============================================================================
--  TODO ÉTAPE 3-A : EXTENSIONS (à exécuter avec le rôle postgres)
-- ============================================================================

-- Extensions modernes PostgreSQL
CREATE EXTENSION IF NOT EXISTS "citext";        -- Texte insensible à la casse (email, pseudo, titre)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Recherche floue (Trigram) pour le moteur de recherche
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- Indexation performante pour les types standards.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Fonctions crypto (optionnel)


-- >>> 04_add_types.sql
-- ============================================================================
-- TODO ÉTAPE 3-B : TYPES ÉNUMÉRÉS (ENUM) (à exécuter avec le rôle postgres)
-- ============================================================================

-- ! Important : Si vous ajoutez une nouvelle valeur dans un type,il faut le supprimer et le recréer !

-- Forcer l'encodage client

-- Rôles utilisateurs (Access Control Level)
CREATE TYPE role_enum AS ENUM(
    'admin',         -- Gestion des utilisateurs et des droits
    'customer',      -- Utilisateur normal
    'visiteur',      -- Simple visiteur sans droit
    'super_admin'    -- Gestion des droits système
);

COMMENT ON TYPE role_enum IS 'Rôles des utilisateurs pour la gestion des droits Access Controle Level (ACL)';

-- Fournisseurs d'authentification
CREATE TYPE auth_provider_enum AS ENUM(
    'local',        -- Authentification locale
    'google',       -- Authentification Google
    'azure',        -- Authentification Azure
    'apple'         -- Authentification Apple
);
COMMENT ON TYPE auth_provider_enum IS 'Fournisseur d authentification';

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

CREATE TYPE event_category_enum AS ENUM (
    'analytics',   -- Événements métier (login, création review...)
    'audit',       -- Audit trail (modification compte, suppression...)
    'monitoring',  -- Health checks, performance
    'gdpr'         -- Événements RGPD (export, suppression, consentement...)
);

COMMENT ON TYPE event_category_enum IS 'Catégories principales des événements système';

CREATE TYPE severity_enum AS ENUM (
    'info',        -- Information normale
    'warning',     -- Avertissement (ex: tentative de login échouée)
    'error',       -- Erreur récupérable (ex: validation échouée)
    'critical'     -- Erreur critique (ex: base de données inaccessible)
);

COMMENT ON TYPE severity_enum IS 'Niveaux de gravité pour les événements de type monitoring/audit';


-- >>> 01_add_trigger_set_timestamp.sql
-- ============================================================================
--  TODO ÉTAPE 4 : FONCTION TRIGGER : Mise à jour automatique de updated_at

-- Pour ne plus jamais oublier de mettre à jour la colonne updated_at
-- Fonction trigger_set_timestamp a utiliser sur les tables avec une colonne updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;

$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_set_timestamp() IS 'Met à jour automatiquement la colonne updated_at lors d une modification de ligne';


-- >>> 01_add_users_table.sql
-- Relation Merise : Entité indépendante
-- ============================================================================

-- Forcer l'encodage client

CREATE TABLE IF NOT EXISTS users (
    id_user UUID DEFAULT uuidv7 () PRIMARY KEY,
    email CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pseudo CITEXT UNIQUE NOT NULL,
    biographie CITEXT,
    avatar VARCHAR(255),
    role_name role_enum NOT NULL DEFAULT 'visiteur',
    auth_provider auth_provider_enum NOT NULL DEFAULT 'local',
    settings_user JSONB NOT NULL DEFAULT '{}',
    gdpr_consent BOOLEAN NOT NULL DEFAULT FALSE,
    gdpr_consent_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NUll DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Indexation JSONB (Recherche rapide dans les réglages utilisateur)
CREATE INDEX idx_users_settings ON users USING gin (settings_user);
-- "Je crée un index spécial optimisé pour rechercher rapidement dans ma colonne JSONB settings_user."

--Doccumentation

COMMENT ON TABLE users IS 'Stocke les informations d identification et les préférences des utilisateurs (RGPD compliant)';

COMMENT ON COLUMN users.settings_user IS 'Préférences utilisateur en JSONB : {"theme": "dark", "language": "fr", "notifications": true}';

COMMENT ON COLUMN users.gdpr_consent IS 'Consentement RGPD obligatoire pour créer un compte';

COMMENT ON COLUMN users.gdpr_consent_date IS 'Date et heure précises du consentement RGPD';

-- Application du trigger (écouteur d'événement) “Quand il se passe X dans la table, je lance automatiquement une fonction.”
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
-- “À chaque fois qu’un utilisateur est modifié, je mets automatiquement à jour son timestamp.”




-- >>> 02_add_games_table.sql
-- Relation Merise : reviews (1,1) --- (0,N) games (un review appartient à un utilisateur)
-- ============================================================================

-- Forcer l'encodage client

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

CREATE TABLE IF NOT EXISTS tags (
    id_tag UUID DEFAULT uuidv7() PRIMARY KEY,
    tag_name CITEXT NOT NULL, -- CITEXT et VARCHAR ne peuvent pas être ensemble (la taille du tag est défini dans validator)
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NUll DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_user_tag UNIQUE (user_id, tag_name) -- Un utilisateur ne peut pas avoir deux fois le même tag
);

-- Index pour requêtes par utilisateur (liste de ses tags)
CREATE INDEX idx_tags_user ON tags (user_id);

-- Index pour recherche floue sur les noms de tags
CREATE INDEX idx_tags_name_trgm ON tags USING gin (tag_name gin_trgm_ops);


-- Documentation
COMMENT ON TABLE tags IS 'Mots-clés personnalisés créés par les utilisateurs pour organiser leurs reviews';
COMMENT ON COLUMN tags.tag_name IS 'Nom du tag (insensible à la casse via CITEXT)';

-- Application du trigger
CREATE TRIGGER set_timestamp_tags BEFORE UPDATE ON tags FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- >>> 05_add_shares_table.sql
-- Relation Merise : users (0,N) --- (1,1) shares (un PARTAGE CONCERNE UN UTILISATEUR)
-- Relation Merise : reviews (0,N) --- (0,1) shares (un partage peut concerner une review ou non)
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


CREATE TABLE IF NOT EXISTS app_events (
    id_event UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID REFERENCES users(id_user) ON DELETE SET NULL,
    event_category event_category_enum NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    severity severity_enum DEFAULT 'info',
    message CITEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index composite pour filtrer par catégorie + date (requête la plus courante)
CREATE INDEX idx_events_category_date ON app_events (event_category, created_at DESC);

-- Index pour recherche par utilisateur
CREATE INDEX idx_events_user ON app_events (user_id) WHERE user_id IS NOT NULL;

-- Index GIN pour recherche dans metadata
CREATE INDEX idx_events_metadata ON app_events USING gin (metadata);

-- Index pour les événements critiques (alerte monitoring)
CREATE INDEX idx_events_critical ON app_events (severity, created_at DESC) WHERE severity = 'critical';

-- Documentation
COMMENT ON TABLE app_events IS 'Table unifiée pour analytics, audit, monitoring et événements RGPD';
COMMENT ON COLUMN app_events.event_type IS 'Type précis avec convention : [domaine].[action] (ex: user.login, review.created, gdpr.export)';
COMMENT ON COLUMN app_events.severity IS 'Niveau de gravité (utile pour filtrer les alertes monitoring)';
COMMENT ON COLUMN app_events.message IS 'Message lisible pour les humains (logs, dashboards)';
COMMENT ON COLUMN app_events.metadata IS 'Contexte flexible en JSONB :
{
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "review_id": "uuid...",
  "error_stack": "...",
  "duration_ms": 234
}';


-- >>> 07_add_review_tags_table_pivot.sql
-- Relation Merise : review (0,N) --- (0,N) tags
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


-- >>> 08_add_user_sessions.sql
--database/migrations/table/08_add_user_sessions_table.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
        CREATE TABLE user_sessions (
            sid VARCHAR PRIMARY KEY,
            sess JSON NOT NULL,
            expire TIMESTAMP(6) NOT NULL
        );
        CREATE INDEX "idx_user_sessions_expire" ON user_sessions(expire);
        RAISE NOTICE 'Table "user_sessions" créée.';
        END IF;
END
$$;

        
        --Cette table sert à stocker les sessions des utilisateurs côté serveur.

        --Quand un utilisateur se connecte :

-- Le serveur crée une session
-- Cette session contient des infos temporaires (ex : user_id, rôle, panier, préférences)
-- La session est associée à un identifiant unique (sid)
-- La session a une date d’expiration (expire)

-- Promote user to admin


-- >>> 00_reviews_with_game.sql
-- Recherche d'une review avec son jeu associé

CREATE VIEW v_reviews_with_game AS
SELECT
r.id_review,
r.user_id,
r.game_id,
r.review_title,
r.slug,
r.review_rate,
r.review_like,
r.review_platine,
r.progression_status,
r.avis_review,
r.game_platforme,
r.created_at,

g.game_title AS game_title,
g.thumbnail_url,
g.release_date,
g.game_genre,

u.pseudo AS user_pseudo,
u.avatar AS user_avatar

FROM reviews r
JOIN games g ON g.id_game = r.game_id -- Jamais de virgule après un JOIN
JOIN users u ON u.id_user = r.user_id;


-- >>> 01_items_with_tags_json.sql
CREATE OR REPLACE VIEW v_reviews_with_tags AS
SELECT r.id_review, r.user_id, r.review_title, COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', t.id_tag, 'name', t.tag_name
            )
        ) FILTER (
            WHERE
                t.id_tag IS NOT NULL
        ), '[]'
    ) AS tags
FROM
    reviews AS r
    LEFT JOIN review_tags AS it ON r.id_review = it.id_review
    LEFT JOIN tags AS t ON it.id_tag = t.id_tag
GROUP BY
    r.id_review;


-- Cette vue :

-- joint review et tags
-- transforme la relation many-to-many
-- génère un JSON propre
-- garantit un tableau vide au lieu de null
-- est parfaite pour une API


-- >>> 02_orphan_items_view.sql
CREATE OR REPLACE VIEW v_orphan_reviews AS
SELECT r.review_title, u.pseudo AS owner_pseudo
FROM
    reviews AS r
    JOIN users AS u ON r.user_id = u.id_user
    LEFT JOIN review_tags AS it ON r.id_review = it.id_review
WHERE
    it.id_review IS NULL;


-- Cette vue :

-- Cherche toutes les reviews
-- Qui ont aucun tag
-- Récupère aussi le pseudo du propriétaire
-- Est utile pour le debug ou un tableau d’administration


-- >>> 03_shared_items_view.sql
CREATE OR REPLACE VIEW v_shared_access AS
-- Partages de reviews
SELECT 
    u.email AS owner_email,
    r.review_title AS review_title,
    s.recipient_email,
    'review' AS shared_type
FROM shares AS s
JOIN reviews AS r ON s.review_id = r.id_review
JOIN users AS u ON r.user_id = u.id_user

UNION ALL

-- Partages d'utilisateurs
SELECT 
    u.email AS owner_email,
    NULL AS review_title,
    s.recipient_email,
    'user' AS shared_type
FROM shares AS s
JOIN users AS u ON s.user_id = u.id_user
WHERE s.review_id IS NULL;

-- Deux blocs distincts avec UNION ALL

-- Le premier : tous les partages de reviews
-- Le second : tous les partages d’utilisateurs


-- >>> 04_user_activity_summary_view.sql
CREATE OR REPLACE VIEW v_user_activity_metrics AS
SELECT
    u.pseudo,
    COUNT(DISTINCT r.id_review) AS total_reviews,
    COUNT(DISTINCT t.id_tag) AS total_tags_created
FROM users AS u
    LEFT JOIN reviews AS r ON u.id_user = r.user_id
    LEFT JOIN tags AS t ON u.id_user = t.user_id
GROUP BY
    u.id_user,
    u.pseudo;

    -- Bloc pour consulter l'activité d'un utilisateur, le nombre de review et tag qu'il à crée.


-- >>> 05_v_reviews_complet_view.sql
CREATE OR REPLACE VIEW v_reviews_complete AS
SELECT
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.avis_review,
    r.review_rate,
    r.game_platforme,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.created_at,
    r.updated_at,

    -- Informations du jeu
    g.igdb_id,
    g.game_title AS game_title,
    g.game_genre,
    g.thumbnail_url,
    g.release_date,

    -- Informations utilisateur
    u.pseudo AS user_pseudo,
    u.avatar AS user_avatar,

    -- Tags associés à la review
    COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'id', t.id_tag,
            'name', t.tag_name
        )) FILTER (WHERE t.id_tag IS NOT NULL),
        '[]'::json
    ) AS tags,

    -- Partages associés à la review
    COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'id', s.id_share,
            'token', s.share_token,
            'createdAt', s.created_at,
            'updatedAt', s.updated_at
        )) FILTER (WHERE s.id_share IS NOT NULL),
        '[]'::json
    ) AS shares

FROM reviews r
JOIN games g
    ON r.game_id = g.id_game
JOIN users u
    ON r.user_id = u.id_user
LEFT JOIN review_tags rt
    ON r.id_review = rt.id_review
LEFT JOIN tags t
    ON rt.id_tag = t.id_tag
LEFT JOIN shares s
    ON r.id_review = s.review_id

GROUP BY
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.avis_review,
    r.review_rate,
    r.game_platforme,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.created_at,
    r.updated_at,
    g.igdb_id,
    g.game_title,
    g.game_genre,
    g.thumbnail_url,
    g.release_date,
    u.pseudo,
    u.avatar;


-- >>> 06_v_user_review_view.sql
CREATE OR REPLACE VIEW v_user_reviews AS
SELECT *
FROM v_reviews_with_tags;

-- Lie les reviews avec l'utilisateur


-- >>> 07_v_user_tags_view.sql
CREATE OR REPLACE VIEW v_user_tags AS
SELECT
  id_tag,
  tag_name,
  user_id,
  created_at,
  updated_at
FROM tags;


-- Lie les tags avec l'utilisateur


-- >>> 08_user_tags_with_count_view.sql
CREATE OR REPLACE VIEW v_user_tags_with_count AS
SELECT
  t.id_tag,
  t.tag_name,
  t.user_id,
  t.created_at,
  t.updated_at,
  COUNT(it.id_review) AS review_count
FROM tags t
LEFT JOIN review_tags it ON t.id_tag = it.id_tag
GROUP BY t.id_tag;

-- Nombre de tags crée par l'utilisateur (prend en compte les reviews)


-- >>> 09_v_users_admin_view.sql
CREATE VIEW v_users_admin AS
SELECT
  id_user,
  email,
  pseudo,
  role_name,
  auth_provider,
  created_at,
  updated_at
FROM users;


-- Vu pour définir une entité admin


-- >>> 10_v_users_profile_with_stats_views.sql
CREATE VIEW v_user_profile_with_stats AS
SELECT
    u.id_user,
    u.email,
    u.pseudo,
    u.role_name,
    u.auth_provider,
    u.settings_user,
    u.gdpr_consent,
    u.created_at,
    COUNT(DISTINCT r.id_review) AS reviews_count,
    COUNT(DISTINCT t.id_tag) AS tags_count
FROM users u
LEFT JOIN reviews r ON r.user_id = u.id_user
LEFT JOIN tags t ON t.user_id = u.id_user
GROUP BY u.id_user;

-- Vue utile pour afficher les stats de création (création de review et de tag) sur le profil de l'utilisateur


-- >>> 11_v_share_public_access_review_view.sql
CREATE OR REPLACE VIEW v_share_public_review AS
SELECT
    s.id_share,
    s.share_token,
    s.recipient_email,
    s.access_config,
    s.created_at AS share_created_at,
    s.updated_at,

    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.avis_review,
    r.review_rate,
    r.game_platforme,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.created_at AS review_created_at,
    r.updated_at AS review_updated_at,

    g.game_title,
    g.thumbnail_url,
    g.game_genre,
    g.release_date,

    u.pseudo AS user_pseudo,
    u.avatar AS user_avatar

FROM shares s
JOIN reviews r
    ON r.id_review = s.review_id
JOIN games g
    ON g.id_game = r.game_id
JOIN users u
    ON u.id_user = r.user_id
WHERE s.review_id IS NOT NULL;


-- >>> 12_v_share_public_access_profil_view.sql

CREATE OR REPLACE VIEW v_share_public_profile AS
SELECT
    s.id_share,
    s.share_token,
    s.recipient_email,
    s.access_config,
    s.created_at AS share_created_at,
    s.updated_at,

    u.id_user,
    u.pseudo,
    u.avatar,
    u.biographie,
    u.created_at AS user_created_at,

    COUNT(r.id_review) AS total_reviews,
    COUNT(*) FILTER (WHERE r.progression_status = 'Terminé') AS finished_games,
    COUNT(*) FILTER (WHERE r.review_platine = true) AS platine_games,
    COUNT(*) FILTER (WHERE r.review_like = true) AS liked_games

FROM shares s
JOIN users u
    ON u.id_user = s.user_id
LEFT JOIN reviews r
    ON r.user_id = u.id_user
WHERE s.review_id IS NULL
GROUP BY
    s.id_share,
    s.share_token,
    s.recipient_email,
    s.access_config,
    s.created_at,
    s.updated_at,
    u.id_user,
    u.pseudo,
    u.avatar,
    u.biographie,
    u.created_at;


-- >>> 13_v_user_app_events_view.sql
CREATE VIEW v_user_app_events AS
SELECT
  id_event,
  user_id,
  event_category,
  event_type,
  severity,
  message,
  created_at
FROM app_events;

-- Lie un évenement applicatif avec un utilisateur


-- >>> 14_v_app_events_critical_view.sql
CREATE VIEW v_app_events_critical AS
SELECT
  id_event,
  user_id,
  event_category,
  event_type,
  severity,
  message,
  created_at
FROM app_events
WHERE severity IN ('warning', 'error', 'critical');

-- Lie un évenement applicatif critique avec un utilisateur


-- >>> 15_v_reviews_search_view.sql
CREATE OR REPLACE VIEW v_reviews_search AS
SELECT
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.game_platforme,
    r.created_at,

    g.game_title AS game_title,
    g.thumbnail_url,
    g.game_genre,

    COALESCE(
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'id', t.id_tag,
                'name', t.tag_name
            )
        ) FILTER (WHERE t.id_tag IS NOT NULL),
        '[]'::json
    ) AS tags

FROM reviews r
JOIN games g
    ON g.id_game = r.game_id
LEFT JOIN review_tags rt
    ON rt.id_review = r.id_review
LEFT JOIN tags t
    ON t.id_tag = rt.id_tag

GROUP BY
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.game_platforme,
    r.created_at,
    g.game_title,
    g.thumbnail_url,
    g.game_genre;

    -- Cette vue sert à afficher une version moins détaillé des review (review-index) à différencier avec review show ou il y aura tout les détails d'une review


-- >>> 16_v_user_shares_view.sql
CREATE OR REPLACE VIEW v_user_shares AS
SELECT
    s.id_share,
    s.user_id,
    s.review_id,
    s.recipient_email,
    s.share_token,
    s.access_config,
    s.created_at,
    s.updated_at,

    CASE
        WHEN s.review_id IS NULL THEN 'profile'
        ELSE 'review'
    END AS share_type,

    -- Infos review (si partage d'une review)
    r.id_review,
    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,
    r.game_platforme,
    r.review_like,
    r.review_platine,
    r.avis_review,

    -- Infos jeu (si partage d'une review)
    g.id_game,
    g.game_title,
    g.thumbnail_url,
    g.game_genre,
    g.release_date,

    -- Propriétaire du partage
    u.id_user AS owner_id,
    u.pseudo AS owner_pseudo,
    u.avatar AS owner_avatar,
    u.biographie AS owner_biographie

FROM shares s
JOIN users u
    ON u.id_user = s.user_id
LEFT JOIN reviews r
    ON r.id_review = s.review_id
LEFT JOIN games g
    ON g.id_game = r.game_id;


-- Down Migration
DROP VIEW IF EXISTS v_user_shares CASCADE;
DROP VIEW IF EXISTS v_reviews_search CASCADE;
DROP VIEW IF EXISTS v_app_events_critical CASCADE;
DROP VIEW IF EXISTS v_user_app_events CASCADE;
DROP VIEW IF EXISTS v_share_public_profile CASCADE;
DROP VIEW IF EXISTS v_share_public_review CASCADE;
DROP VIEW IF EXISTS v_user_profile_with_stats CASCADE;
DROP VIEW IF EXISTS v_users_admin CASCADE;
DROP VIEW IF EXISTS v_user_tags_with_count CASCADE;
DROP VIEW IF EXISTS v_user_tags CASCADE;
DROP VIEW IF EXISTS v_user_reviews CASCADE;
DROP VIEW IF EXISTS v_reviews_complete CASCADE;
DROP VIEW IF EXISTS v_user_activity_metrics CASCADE;
DROP VIEW IF EXISTS v_shared_access CASCADE;
DROP VIEW IF EXISTS v_orphan_reviews CASCADE;
DROP VIEW IF EXISTS v_reviews_with_tags CASCADE;
DROP VIEW IF EXISTS v_reviews_with_game CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS review_tags CASCADE;
DROP TABLE IF EXISTS shares CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS app_events CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp() CASCADE;
DROP TYPE IF EXISTS role_enum CASCADE;
DROP TYPE IF EXISTS auth_provider_enum CASCADE;
DROP TYPE IF EXISTS progression_status_enum CASCADE;
DROP TYPE IF EXISTS game_platforme_enum CASCADE;
DROP TYPE IF EXISTS event_category_enum CASCADE;
DROP TYPE IF EXISTS severity_enum CASCADE;

-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Catalogue local : chaque réponse d'API alimente durablement notre
-- base pour que les appels diminuent à mesure qu'elle se remplit.
-- ═══════════════════════════════════════════════════════════════

-- Date de la dernière récupération chez la source (rafraîchissement espacé)
ALTER TABLE items ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Requêtes de recherche déjà posées à une API : les œuvres trouvées sont en base
CREATE TABLE search_cache (
    source VARCHAR(20) NOT NULL,
    type_key VARCHAR(20) NOT NULL DEFAULT '',   -- catégorie demandée, '' pour toutes
    query_norm VARCHAR(200) NOT NULL,
    item_ids UUID[] NOT NULL DEFAULT '{}',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source, type_key, query_norm)
);

-- Œuvres similaires d'une œuvre (recommandations du jour), partagées entre utilisateurs
CREATE TABLE item_similar (
    item_id UUID PRIMARY KEY REFERENCES items (id_item) ON DELETE CASCADE,
    similar_ids UUID[] NOT NULL DEFAULT '{}',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Correspondances validées lors des imports (titre et année d'un export vers une œuvre)
CREATE TABLE import_matches (
    item_type item_type_enum NOT NULL,
    key_norm VARCHAR(250) NOT NULL,             -- titre normalisé + année
    item_id UUID NOT NULL REFERENCES items (id_item) ON DELETE CASCADE,
    confirmations INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_type, key_norm)
);

-- Down Migration

DROP TABLE IF EXISTS import_matches;
DROP TABLE IF EXISTS item_similar;
DROP TABLE IF EXISTS search_cache;
ALTER TABLE items DROP COLUMN IF EXISTS fetched_at;

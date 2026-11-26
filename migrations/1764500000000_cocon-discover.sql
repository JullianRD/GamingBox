-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Découverte : sélections du jour par utilisateur et par catégorie,
-- et cache des tendances des API (une ligne par catégorie).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE daily_picks (
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    pick_date DATE NOT NULL,
    item_type item_type_enum NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',          -- œuvres proposées et raison (« Parce que tu as aimé... »)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, pick_date, item_type)
);
COMMENT ON TABLE daily_picks IS 'Recommandations du jour, calculées une fois par jour et par catégorie';

CREATE TABLE trending_cache (
    item_type item_type_enum PRIMARY KEY,
    items JSONB NOT NULL DEFAULT '[]',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_items_created ON user_items (created_at DESC);

-- Down Migration

DROP INDEX IF EXISTS idx_user_items_created;
DROP TABLE IF EXISTS trending_cache;
DROP TABLE IF EXISTS daily_picks;

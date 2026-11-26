-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Manga : collection de tomes par entrée (possédé, lu).
-- Le nombre de tomes vient du catalogue (AniList) ; l'utilisateur
-- peut le fixer lui-même pour une série en cours ou mal renseignée.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE user_items ADD COLUMN IF NOT EXISTS volumes_total SMALLINT CHECK (volumes_total BETWEEN 1 AND 500);

CREATE TABLE entry_volumes (
    user_item_id UUID NOT NULL REFERENCES user_items (id_user_item) ON DELETE CASCADE,
    number SMALLINT NOT NULL CHECK (number BETWEEN 1 AND 500),
    state VARCHAR(10) NOT NULL CHECK (state IN ('owned', 'read')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_item_id, number)
);

-- Down Migration

DROP TABLE IF EXISTS entry_volumes;
ALTER TABLE user_items DROP COLUMN IF EXISTS volumes_total;

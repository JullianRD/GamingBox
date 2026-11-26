-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Défis : résultats des mini-jeux (duels « Tu préfères », blindtest).
-- Une partie en cours vit dans la session ; seule la fin est gardée.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE challenge_results (
    id_challenge_result UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    game VARCHAR(20) NOT NULL CHECK (game IN ('duel', 'blindtest')),
    mode VARCHAR(30) NOT NULL,                  -- library, characters, openings, trending / music, openings, covers
    item_type item_type_enum,
    title VARCHAR(150) NOT NULL,
    score INTEGER,                              -- blindtest : bonnes réponses
    total INTEGER NOT NULL,                     -- blindtest : questions ; duel : participants
    payload JSONB NOT NULL DEFAULT '{}',        -- duel : vainqueur et classement ; blindtest : récapitulatif
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_challenge_results_user ON challenge_results (user_id, created_at DESC);
CREATE INDEX idx_challenge_results_board ON challenge_results (game, mode, score DESC);

ALTER TYPE activity_kind_enum ADD VALUE IF NOT EXISTS 'challenged';

-- Down Migration

DELETE FROM activities WHERE kind = 'challenged';
DROP TABLE IF EXISTS challenge_results;

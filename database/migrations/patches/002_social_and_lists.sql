-- 002 : reviews publiques, listes thématiques, abonnements, likes, index de filtrage
SET CLIENT_ENCODING TO 'UTF8';

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_status ON reviews (user_id, progression_status);
CREATE INDEX IF NOT EXISTS idx_reviews_public ON reviews (created_at DESC) WHERE is_public;

-- Listes thématiques ("Mes 10 meilleurs RPG", "À finir en 2026"...)
CREATE TABLE IF NOT EXISTS game_lists (
    id_list UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    slug CITEXT NOT NULL,
    description VARCHAR(500),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_user_list_slug UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS game_list_items (
    list_id UUID NOT NULL REFERENCES game_lists (id_list) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games (id_game) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    note VARCHAR(300),
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_lists_user ON game_lists (user_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_game_lists') THEN
        CREATE TRIGGER set_timestamp_game_lists BEFORE UPDATE ON game_lists
            FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END
$$;

-- Abonnements entre utilisateurs
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    CONSTRAINT no_self_follow CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_followed ON user_follows (followed_id);

-- Likes sur les reviews publiques
CREATE TABLE IF NOT EXISTS review_likes (
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    review_id UUID NOT NULL REFERENCES reviews (id_review) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_review ON review_likes (review_id);

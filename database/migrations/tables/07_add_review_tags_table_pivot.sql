-- Relation Merise : review (0,N) --- (0,N) tags
-- ============================================================================

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

CREATE TABLE IF NOT EXISTS review_tags (
    id_tag UUID REFERENCES tags (id_tag) ON DELETE CASCADE,
    id_review UUID REFERENCES reviews (id_review) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_tag, id_review)
);

CREATE INDEX idx_review_tags_tag ON review_tags (id_tag);

COMMENT ON TABLE review_tags IS 'Table de liaison gérant la relation Many-to-Many entre Reviews et Tags';
-- Application du trigger
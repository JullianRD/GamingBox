-- Relation Merise : review (0,N) --- (0,N) tags
-- ============================================================================

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

CREATE TABLE IF NOT EXISTS review_tags (
    review_tag UUID REFERENCES tags (id_tag) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews (id_review) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_tag, id_review) -- Clé primaire composite (une review ne peut avoir le même tag qu'une seule fois)
);

-- Index pour requêtes inverses (toutes les reviews d'un tag)
CREATE INDEX idx_review_tags_tag ON review_tags (id_tag);

-- Documentation
COMMENT ON TABLE review_tags IS 'Table de liaison gérant la relation Many-to-Many entre Reviews et Tags';
-- Application du trigger
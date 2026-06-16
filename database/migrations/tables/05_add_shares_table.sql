-- Relation Merise : users (0,N) --- (1,1) shares (un PARTAGE CONCERNE UN UTILISATEUR)
-- Relation Merise : reviews (0,N) --- (0,1) shares (un partage peut concerner une review ou non)
-- ============================================================================

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

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
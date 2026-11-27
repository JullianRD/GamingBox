-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Administration : suspension, dernière connexion, signalements,
-- et alias des œuvres fusionnées (doublons du catalogue).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(300),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Une œuvre fusionnée dans une autre : son identifiant chez la source pointe désormais vers la cible,
-- pour qu'une recherche ou un import ne recrée pas le doublon
CREATE TABLE item_aliases (
    source VARCHAR(20) NOT NULL,
    external_id VARCHAR(64) NOT NULL,
    item_id UUID NOT NULL REFERENCES items (id_item) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source, external_id)
);

CREATE TYPE report_target_enum AS ENUM ('comment', 'user');
CREATE TYPE report_reason_enum AS ENUM ('spam', 'harassment', 'inappropriate', 'other');
CREATE TYPE report_status_enum AS ENUM ('open', 'resolved', 'dismissed');

CREATE TABLE reports (
    id_report UUID DEFAULT uuidv7() PRIMARY KEY,
    reporter_id UUID REFERENCES users (id_user) ON DELETE SET NULL,
    target_type report_target_enum NOT NULL,
    target_id UUID NOT NULL,                    -- commentaire ou utilisateur signalé
    reason report_reason_enum NOT NULL,
    details VARCHAR(500),
    snapshot JSONB NOT NULL DEFAULT '{}',       -- texte et auteur au moment du signalement
    status report_status_enum NOT NULL DEFAULT 'open',
    resolved_by UUID REFERENCES users (id_user) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution VARCHAR(40),                     -- deleted, suspended, dismissed
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Un même utilisateur ne signale qu'une fois une même cible tant que le signalement est ouvert
CREATE UNIQUE INDEX idx_reports_open_unique ON reports (reporter_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX idx_reports_status ON reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_audit ON app_events (created_at DESC) WHERE event_category = 'audit';

-- Down Migration

DROP INDEX IF EXISTS idx_events_audit;
DROP INDEX IF EXISTS idx_users_email_trgm;
DROP TABLE IF EXISTS reports;
DROP TYPE IF EXISTS report_status_enum;
DROP TYPE IF EXISTS report_reason_enum;
DROP TYPE IF EXISTS report_target_enum;
DROP TABLE IF EXISTS item_aliases;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at, DROP COLUMN IF EXISTS suspended_reason, DROP COLUMN IF EXISTS suspended_at;

-- Up Migration

-- ═══════════════════════════════════════════════════════════════
-- Imports : une ligne par import lancé, une ligne par œuvre lue
-- dans le fichier ou le compte source. Le traitement tourne dans
-- le processus de l'app et reprend au redémarrage.
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE import_status_enum AS ENUM ('matching', 'review', 'applying', 'done', 'failed');
CREATE TYPE import_row_state_enum AS ENUM ('pending', 'matched', 'ambiguous', 'unmatched', 'skipped', 'applied');

CREATE TABLE imports (
    id_import UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL,                -- letterboxd, trakt, steam, mal, goodreads, lastfm, csv
    label VARCHAR(200),                          -- nom du fichier ou du compte importé
    status import_status_enum NOT NULL DEFAULT 'matching',
    options JSONB NOT NULL DEFAULT '{}',
    total INTEGER NOT NULL DEFAULT 0,
    processed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
CREATE INDEX idx_imports_user ON imports (user_id, created_at DESC);
CREATE INDEX idx_imports_running ON imports (status) WHERE status IN ('matching', 'applying');
CREATE TRIGGER set_timestamp_imports BEFORE UPDATE ON imports FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE import_rows (
    id_import_row UUID DEFAULT uuidv7() PRIMARY KEY,
    import_id UUID NOT NULL REFERENCES imports (id_import) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    data JSONB NOT NULL,                         -- ligne lue : titre, année, statut, note, avis...
    state import_row_state_enum NOT NULL DEFAULT 'pending',
    match JSONB,                                 -- œuvre retenue (format catalogue)
    candidates JSONB NOT NULL DEFAULT '[]',      -- propositions quand la correspondance est incertaine
    CONSTRAINT unique_import_row_position UNIQUE (import_id, position)
);
CREATE INDEX idx_import_rows_state ON import_rows (import_id, state);

COMMENT ON TABLE import_rows IS 'Lignes d un import et leur correspondance dans le catalogue';

-- Down Migration

DROP TABLE IF EXISTS import_rows;
DROP TABLE IF EXISTS imports;
DROP TYPE IF EXISTS import_row_state_enum;
DROP TYPE IF EXISTS import_status_enum;

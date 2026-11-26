-- 001 : vérification d'email, réinitialisation de mot de passe, profil public
SET CLIENT_ENCODING TO 'UTF8';

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Les comptes existants sont considérés comme vérifiés (migration unique)
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- Jetons à usage unique (stockés hashés : un dump de la base ne donne aucun jeton utilisable)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id_token UUID DEFAULT uuidv7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id_user) ON DELETE CASCADE,
    token_type VARCHAR(30) NOT NULL CHECK (token_type IN ('email_verify', 'password_reset')),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id, token_type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens (expires_at);

COMMENT ON TABLE auth_tokens IS 'Jetons à usage unique : vérification d email et reset de mot de passe (hash SHA-256)';

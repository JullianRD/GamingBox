-- ============================================================================
-- SEEDER 01 : UTILISATEURS
-- Fichier: database/seeders/01_add_users_seeders.sql
-- ============================================================================

-- Nettoyage préalable (si nécessaire)
TRUNCATE TABLE users CASCADE;

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO users (
    id_user,
    email,
    password_hash,
    pseudo,
    role_name,
    auth_provider
) VALUES
    (
        '11111111-1111-7111-8111-111111111111',
        'alex.gamer@gamingbox.dev',
        '$2b$12$placeholderHashAlex',
        'AlexPlayer',
        'customer',
        'local'
    )
ON CONFLICT (id_user) DO NOTHING;

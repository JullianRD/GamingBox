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
    biographie,
    role_name,
    auth_provider,
    settings_user,
    gdpr_consent,
    gdpr_consent_date,
    created_at,
    updated_at
) VALUES
    (
        '11111111-1111-7111-8111-111111111111',
        'alex.gamer@gamingbox.dev',
        '$2b$12$placeholderHashAlex',
        'AlexPlayer',
        'Joue surtout a des RPG narratifs.',
        'customer',
        'local',
        '{"theme":"dark","language":"fr","notifications":true}'::jsonb,
        TRUE,
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '10 days'
    ),
    (
        '22222222-2222-7222-8222-222222222222',
        'sara.console@gamingbox.dev',
        '$2b$12$placeholderHashSara',
        'SaraConsole',
        'Fan de jeux coop et de sessions speedrun.',
        'customer',
        'google',
        '{"theme":"light","language":"fr","notifications":false}'::jsonb,
        TRUE,
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '5 days'
    ),
    (
        '33333333-3333-7333-8333-333333333333',
        'milo.admin@gamingbox.dev',
        '$2b$12$placeholderHashMilo',
        'MiloAdmin',
        'Moderation et curation des reviews.',
        'admin',
        'azure',
        '{"theme":"dark","language":"en","notifications":true}'::jsonb,
        TRUE,
        NOW() - INTERVAL '60 days',
        NOW() - INTERVAL '60 days',
        NOW() - INTERVAL '2 days'
    )
ON CONFLICT (id_user) DO NOTHING;

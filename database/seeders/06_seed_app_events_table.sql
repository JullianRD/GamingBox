SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO app_events (
    id_event,
    user_id,
    event_category,
    event_type,
    severity,
    message,
    metadata,
    created_at
)
SELECT
    '12121111-1111-7111-8111-111111111111',
    u.id_user,
    'analytics',
    'user.login',
    'info',
    'Connexion utilisateur reussie',
    '{"ip":"127.0.0.1","user_agent":"seed-script","duration_ms":55}'::jsonb,
    NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'alex.gamer@gamingbox.dev'
ON CONFLICT (id_event) DO NOTHING;

INSERT INTO app_events (
    id_event,
    user_id,
    event_category,
    event_type,
    severity,
    message,
    metadata,
    created_at
)
SELECT
    '12122222-2222-7222-8222-222222222222',
    u.id_user,
    'audit',
    'review.created',
    'info',
    'Creation de review',
    '{"entity":"reviews","source":"seed-script"}'::jsonb,
    NOW() - INTERVAL '1 day'
FROM users u
WHERE u.email = 'sara.console@gamingbox.dev'
ON CONFLICT (id_event) DO NOTHING;

INSERT INTO app_events (
    id_event,
    user_id,
    event_category,
    event_type,
    severity,
    message,
    metadata,
    created_at
)
VALUES (
    '12123333-3333-7333-8333-333333333333',
    NULL,
    'monitoring',
    'db.healthcheck',
    'warning',
    'Latence elevee detectee',
    '{"latency_ms":420,"source":"seed-script"}'::jsonb,
    NOW() - INTERVAL '12 hours'
)
ON CONFLICT (id_event) DO NOTHING;


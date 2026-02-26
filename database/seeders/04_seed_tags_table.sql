SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO tags (
    id_tag,
    tag_name,
    user_id,
    created_at,
    updated_at
)
SELECT
    'dddd1111-1111-7111-8111-111111111111',
    'RPG',
    u.id_user,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '3 days'
FROM users u
WHERE u.email = 'alex.gamer@gamingbox.dev'
ON CONFLICT (id_tag) DO NOTHING;

INSERT INTO tags (
    id_tag,
    tag_name,
    user_id,
    created_at,
    updated_at
)
SELECT
    'eeee2222-2222-7222-8222-222222222222',
    'Coop',
    u.id_user,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'sara.console@gamingbox.dev'
ON CONFLICT (id_tag) DO NOTHING;

INSERT INTO tags (
    id_tag,
    tag_name,
    user_id,
    created_at,
    updated_at
)
SELECT
    'ffff3333-3333-7333-8333-333333333333',
    'Inde',
    u.id_user,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day'
FROM users u
WHERE u.email = 'alex.gamer@gamingbox.dev'
ON CONFLICT (id_tag) DO NOTHING;


SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO reviews (
    id_review,
    user_id,
    game_id,
    review_title,
    game_title,
    slug,
    release_date,
    game_genre,
    thumbnail_url,
    metadata,
    review_rate,
    review_like,
    review_platine,
    progression_status,
    avis_review,
    game_platforme,
    created_at,
    updated_at
)
SELECT
    'aaaa1111-1111-7111-8111-111111111111',
    u.id_user,
    g.id_game,
    'Une claque narrative',
    g.game_title,
    'une-claque-narrative',
    g.release_date,
    g.game_genre,
    g.thumbnail_url,
    '{"hours_played":42,"difficulty":"normal","source":"manual_seed"}'::jsonb,
    9.20,
    TRUE,
    FALSE,
    'Dropped',
    'Excellent rythme et excellente DA.',
    'PC',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '2 days'
FROM users u
JOIN games g ON g.game_title = 'The Witcher 3: Wild Hunt'
WHERE u.email = 'alex.gamer@gamingbox.dev'
ON CONFLICT (id_review) DO NOTHING;

INSERT INTO reviews (
    id_review,
    user_id,
    game_id,
    review_title,
    game_title,
    slug,
    release_date,
    game_genre,
    thumbnail_url,
    metadata,
    review_rate,
    review_like,
    review_platine,
    progression_status,
    avis_review,
    game_platforme,
    created_at,
    updated_at
)
SELECT
    'bbbb2222-2222-7222-8222-222222222222',
    u.id_user,
    g.id_game,
    'Un open world dense',
    g.game_title,
    'un-open-world-dense',
    g.release_date,
    g.game_genre,
    g.thumbnail_url,
    '{"hours_played":65,"difficulty":"hard","source":"manual_seed"}'::jsonb,
    8.70,
    TRUE,
    TRUE,
    'Whislist',
    'Contenu riche, mais quelques lenteurs.',
    'Console de jeu',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '1 day'
FROM users u
JOIN games g ON g.game_title = 'Elden Ring'
WHERE u.email = 'sara.console@gamingbox.dev'
ON CONFLICT (id_review) DO NOTHING;

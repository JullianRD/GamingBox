SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO games (
    id_game,
    igdb_id,
    game_title,
    game_genre,
    release_date,
    thumbnail_url,
    created_at,
    updated_at
)
VALUES
(
    'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaa1'::uuid,
    1942,
    'The Witcher 3: Wild Hunt',
    'RPG',
    DATE '2015-05-19',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day'
),
(
    'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbb2'::uuid,
    119133,
    'Elden Ring',
    'Action-RPG',
    DATE '2022-02-25',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
),
(
    'cccccccc-cccc-7ccc-8ccc-ccccccccccc3'::uuid,
    113112,
    'Hades',
    'Rogue-lite',
    DATE '2020-09-17',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co39vc.jpg',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (id_game) DO NOTHING;
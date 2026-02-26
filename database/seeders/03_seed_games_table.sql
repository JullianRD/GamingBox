SET CLIENT_ENCODING TO 'UTF8';

WITH igdb_candidates AS (
    SELECT
        id_igdb,
        ROW_NUMBER() OVER (ORDER BY id_igdb) AS rn
    FROM igdb
    LIMIT 3
)
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
SELECT
    CASE rn
        WHEN 1 THEN 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaa1'::uuid
        WHEN 2 THEN 'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbb2'::uuid
        ELSE 'cccccccc-cccc-7ccc-8ccc-ccccccccccc3'::uuid
    END AS id_game,
    id_igdb,
    CASE rn
        WHEN 1 THEN 'The Witcher 3: Wild Hunt'
        WHEN 2 THEN 'Elden Ring'
        ELSE 'Hades'
    END AS game_title,
    CASE rn
        WHEN 1 THEN 'RPG'
        WHEN 2 THEN 'Action-RPG'
        ELSE 'Rogue-lite'
    END AS game_genre,
    CASE rn
        WHEN 1 THEN DATE '2015-05-19'
        WHEN 2 THEN DATE '2022-02-25'
        ELSE DATE '2020-09-17'
    END AS release_date,
    CASE rn
        WHEN 1 THEN 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg'
        WHEN 2 THEN 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg'
        ELSE 'https://images.igdb.com/igdb/image/upload/t_cover_big/co39vc.jpg'
    END AS thumbnail_url,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day'
FROM igdb_candidates
ON CONFLICT (id_game) DO NOTHING;


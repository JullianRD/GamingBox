CREATE OR REPLACE VIEW v_reviews_complete AS
SELECT
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.avis_review,
    r.review_rating,
    r.game_platform,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.created_at,
    r.updated_at,

    -- Informations du jeu
    g.igdb_id,
    g.title AS game_title,
    g.gameGenre,
    g.thumbnail_url,
    g.release_date,

    -- Informations utilisateur
    u.pseudo AS user_pseudo,
    u.avatar AS user_avatar,

    -- Tags associés à la review
    COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'id', t.id_tag,
            'name', t.tag_name
        )) FILTER (WHERE t.id_tag IS NOT NULL),
        '[]'::json
    ) AS tags,

    -- Partages associés à la review
    COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'id', s.id_share,
            'token', s.share_token,
            'createdAt', s.created_at,
            'expiresAt', s.expires_at
        )) FILTER (WHERE s.id_share IS NOT NULL),
        '[]'::json
    ) AS shares

FROM reviews r
JOIN games g
    ON r.game_id = g.id_game
JOIN users u
    ON r.user_id = u.id_user
LEFT JOIN review_tags rt
    ON r.id_review = rt.review_id
LEFT JOIN tags t
    ON rt.tag_id = t.id_tag
LEFT JOIN shares s
    ON r.id_review = s.review_id

GROUP BY
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.avis_review,
    r.review_rating,
    r.game_platform,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.created_at,
    r.updated_at,
    g.igdb_id,
    g.title,
    g.genre,
    g.cover_url,
    g.release_date,
    u.pseudo,
    u.avatar;
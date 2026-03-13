CREATE OR REPLACE VIEW v_reviews_search AS
SELECT
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.game_platforme,
    r.created_at,

    g.game_title AS game_title,
    g.thumbnail_url,
    g.game_genre,

    COALESCE(
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'id', t.id_tag,
                'name', t.tag_name
            )
        ) FILTER (WHERE t.id_tag IS NOT NULL),
        '[]'::json
    ) AS tags

FROM reviews r
JOIN games g
    ON g.id_game = r.game_id
LEFT JOIN review_tags rt
    ON rt.id_review = r.id_review
LEFT JOIN tags t
    ON t.id_tag = rt.id_tag

GROUP BY
    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.game_platforme,
    r.created_at,
    g.game_title,
    g.thumbnail_url,
    g.game_genre;

    -- Cette vue sert à afficher une version moins détaillé des review (review-index) à différencier avec review show ou il y aura tout les détails d'une review
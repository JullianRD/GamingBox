CREATE OR REPLACE VIEW v_reviews_with_tags AS
SELECT r.id_review, r.user_id, r.game_title, r.thumbnail_url, COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', t.id_tag, 'name', t.tag_name
            )
        ) FILTER (
            WHERE
                t.id_tag IS NOT NULL
        ), '[]'
    ) AS tags
FROM
    reviews AS r
    LEFT JOIN review_tags AS it ON r.id_review = it.id_review
    LEFT JOIN tags AS t ON it.id_tag = t.id_tag
GROUP BY
    r.id_review;


-- Cette vue :

-- joint items et tags
-- transforme la relation many-to-many
-- génère un JSON propre
-- garantit un tableau vide au lieu de null
-- est parfaite pour une API
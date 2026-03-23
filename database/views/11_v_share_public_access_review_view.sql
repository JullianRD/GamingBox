CREATE OR REPLACE VIEW v_share_public_review AS
SELECT
    s.id_share,
    s.share_token,
    s.recipient_email,
    s.access_config,
    s.created_at AS share_created_at,
    s.updated_at,

    r.id_review,
    r.user_id,
    r.game_id,
    r.review_title,
    r.slug,
    r.avis_review,
    r.review_rate,
    r.game_platforme,
    r.progression_status,
    r.review_like,
    r.review_platine,
    r.created_at AS review_created_at,
    r.updated_at AS review_updated_at,

    g.game_title,
    g.thumbnail_url,
    g.game_genre,
    g.release_date,

    u.pseudo AS user_pseudo,
    u.avatar AS user_avatar

FROM shares s
JOIN reviews r
    ON r.id_review = s.review_id
JOIN games g
    ON g.id_game = r.game_id
JOIN users u
    ON u.id_user = r.user_id
WHERE s.review_id IS NOT NULL;
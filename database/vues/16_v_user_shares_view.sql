CREATE OR REPLACE VIEW v_user_shares AS
SELECT
    s.id_share,
    s.user_id,
    s.review_id,
    s.recipient_email,
    s.share_token,
    s.access_config,
    s.created_at,
    s.updated_at,

    CASE
        WHEN s.review_id IS NULL THEN 'profile'
        ELSE 'review'
    END AS share_type,

    -- Infos review (si partage d'une review)
    r.id_review,
    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,
    r.game_platforme,
    r.review_like,
    r.review_platine,
    r.avis_review,

    -- Infos jeu (si partage d'une review)
    g.id_game,
    g.game_title,
    g.thumbnail_url,
    g.game_genre,
    g.release_date,

    -- Propriétaire du partage
    u.id_user AS owner_id,
    u.pseudo AS owner_pseudo,
    u.avatar AS owner_avatar,
    u.biographie AS owner_biographie

FROM shares s
JOIN users u
    ON u.id_user = s.user_id
LEFT JOIN reviews r
    ON r.id_review = s.review_id
LEFT JOIN games g
    ON g.id_game = r.game_id;
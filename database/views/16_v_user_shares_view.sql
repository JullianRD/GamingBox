CREATE OR REPLACE VIEW v_user_shares AS
SELECT
    s.id_share,
    s.user_id,
    s.review_id,
    s.share_token,
    s.access_config,
    s.created_at,
    s.updated_at,

    r.review_title,
    r.slug,
    r.review_rate,
    r.progression_status,

    g.id_game,
    g.game_title AS game_title,
    g.thumbnail_url,

    u.id_user AS owner_id,
    u.pseudo AS owner_pseudo,
    u.avatar AS owner_avatar

FROM shares s
JOIN reviews r
    ON s.review_id = r.id_review
JOIN games g
    ON r.game_id = g.id_game
JOIN users u
    ON r.user_id = u.id_user;

    -- vue utile pour récupérer les infos d'un partage ou plusieurs partages, par exemple pour récupérer tout les partages d'un utilisateur
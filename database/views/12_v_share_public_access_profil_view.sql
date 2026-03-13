-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

CREATE OR REPLACE VIEW v_share_public_profile AS
SELECT
    s.id_share,
    s.share_token,
    s.access_config,
    s.created_at AS share_created_at,
    s.updated_at,

    u.id_user,
    u.pseudo,
    u.avatar,
    u.biographie,
    u.created_at AS user_created_at,

    -- Statistiques utilisateur
    COUNT(r.id_review) AS total_reviews,

    COUNT(*) FILTER (
        WHERE r.progression_status = 'Terminé'
    ) AS finished_games,

    COUNT(*) FILTER (
        WHERE r.review_platine = true
    ) AS platine_games,

    COUNT(*) FILTER (
        WHERE r.review_like = true
    ) AS liked_games

FROM shares s
JOIN users u
    ON u.id_user = s.user_id

LEFT JOIN reviews r
    ON r.user_id = u.id_user

GROUP BY
    s.id_share,
    s.share_token,
    s.access_config,
    s.created_at,
    s.updated_at,
    u.id_user,
    u.pseudo,
    u.avatar,
    u.biographie,
    u.created_at;

    -- vue utile pour les partages de profil avec stast et infos complète
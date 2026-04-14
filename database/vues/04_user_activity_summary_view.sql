CREATE OR REPLACE VIEW v_user_activity_metrics AS
SELECT
    u.pseudo,
    COUNT(DISTINCT r.id_review) AS total_reviews,
    COUNT(DISTINCT t.id_tag) AS total_tags_created
FROM users AS u
    LEFT JOIN reviews AS r ON u.id_user = r.user_id
    LEFT JOIN tags AS t ON u.id_user = t.user_id
GROUP BY
    u.id_user,
    u.pseudo;

    -- Bloc pour consulter l'activité d'un utilisateur, le nombre de review et tag qu'il à crée.

CREATE VIEW v_user_profile_with_stats AS
SELECT
    u.id_user,
    u.email,
    u.pseudo,
    u.role_name,
    u.auth_provider,
    u.settings_user,
    u.gdpr_consent,
    u.created_at,
    COUNT(DISTINCT r.id_review) AS reviews_count,
    COUNT(DISTINCT t.id_tag) AS tags_count
FROM users u
LEFT JOIN reviews r ON r.user_id = u.id_user
LEFT JOIN tags t ON t.user_id = u.id_user
GROUP BY u.id_user;

-- Vue utile pour afficher les stats de création (création de review et de tag) sur le profil de l'utilisateur
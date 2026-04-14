CREATE OR REPLACE VIEW v_shared_access AS
-- Partages de reviews
SELECT 
    u.email AS owner_email,
    r.review_title AS review_title,
    s.recipient_email,
    'review' AS shared_type
FROM shares AS s
JOIN reviews AS r ON s.review_id = r.id_review
JOIN users AS u ON r.user_id = u.id_user

UNION ALL

-- Partages d'utilisateurs
SELECT 
    u.email AS owner_email,
    NULL AS review_title,
    s.recipient_email,
    'user' AS shared_type
FROM shares AS s
JOIN users AS u ON s.user_id = u.id_user
WHERE s.review_id IS NULL;

-- Deux blocs distincts avec UNION ALL

-- Le premier : tous les partages de reviews
-- Le second : tous les partages d’utilisateurs
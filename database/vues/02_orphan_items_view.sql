CREATE OR REPLACE VIEW v_orphan_reviews AS
SELECT r.review_title, u.pseudo AS owner_pseudo
FROM
    reviews AS r
    JOIN users AS u ON r.user_id = u.id_user
    LEFT JOIN review_tags AS it ON r.id_review = it.id_review
WHERE
    it.id_review IS NULL;


-- Cette vue :

-- Cherche toutes les reviews
-- Qui ont aucun tag
-- Récupère aussi le pseudo du propriétaire
-- Est utile pour le debug ou un tableau d’administration
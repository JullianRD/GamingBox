CREATE OR REPLACE VIEW v_user_reviews AS
SELECT *
FROM v_reviews_with_tags;

-- Lie les reviews avec l'utilisateur

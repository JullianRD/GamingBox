-- Recherche d'une review avec son jeu associé

CREATE VIEW v_reviews_with_game AS
SELECT
r.id_review,
r.user_id,
r.game_id,
r.review_title,
r.slug,
r.review_rate,
r.review_like,
r.review_platine,
r.progression_status,
r.avis_review,
r.game_platforme,
r.created_at,

g.game_title AS game_title,
g.thumbnail_url,
g.release_date,
g.game_genre,

u.pseudo AS user_pseudo,
u.avatar AS user_avatar

FROM reviews r
JOIN games g ON g.id_game = r.game_id -- Jamais de virgule après un JOIN
JOIN users u ON u.id_user = r.user_id;
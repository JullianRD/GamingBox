-- ============================================================================
-- SEEDER 10 : SOCIAL (démo)
-- Deux membres fictifs, des abonnements, de l'activité et un commentaire
-- autour du premier utilisateur de démo.
-- ============================================================================
SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO users (email, password_hash, pseudo, biographie, role_name) VALUES
    ('lea@cocon.dev', '$2b$12$placeholderHashLea', 'Lea', 'Roguelikes, RPG et films de Ghibli.', 'customer'),
    ('sam@cocon.dev', '$2b$12$placeholderHashSam', 'Sam', 'Toujours un jeu de gestion en cours.', 'customer')
ON CONFLICT (email) DO NOTHING;

-- Lea et le compte de démo se suivent (amis) ; Sam suit le compte de démo
INSERT INTO follows (follower_id, followed_id)
SELECT a.id_user, b.id_user FROM users a, users b
WHERE (a.email, b.email) IN (
    ('lea@cocon.dev', 'alex.gamer@cocon.dev'),
    ('alex.gamer@cocon.dev', 'lea@cocon.dev'),
    ('sam@cocon.dev', 'alex.gamer@cocon.dev')
)
ON CONFLICT DO NOTHING;

-- Bibliothèques des membres fictifs
INSERT INTO user_items (user_id, item_id, status, rating, review, is_favorite)
SELECT u.id_user, i.id_item, v.status::entry_status_enum, v.rating, v.review, v.favorite
FROM (VALUES
    ('lea@cocon.dev', '26758',  'completed',   10, 'Le meilleur metroidvania, la direction artistique est sublime.', true),
    ('lea@cocon.dev', '119133', 'in_progress', NULL, NULL, false),
    ('lea@cocon.dev', '113112', 'completed',   9, NULL, false),
    ('sam@cocon.dev', '17000',  'in_progress', 8, NULL, true)
) AS v(email, external_id, status, rating, review, favorite)
JOIN users u ON u.email = v.email
JOIN items i ON i.source = 'igdb' AND i.external_id = v.external_id
ON CONFLICT (user_id, item_id) DO NOTHING;

-- Activité correspondante, étalée sur les derniers jours
INSERT INTO activities (user_id, kind, user_item_id, item_id, payload, created_at)
SELECT ui.user_id, v.kind::activity_kind_enum, ui.id_user_item, ui.item_id, v.payload::jsonb, now() - v.ago::interval
FROM (VALUES
    ('lea@cocon.dev', '26758',  'status',   '{"status":"completed"}', '2 hours'),
    ('lea@cocon.dev', '26758',  'reviewed', '{"excerpt":"Le meilleur metroidvania, la direction artistique est sublime."}', '2 hours'),
    ('lea@cocon.dev', '119133', 'added',    '{"status":"in_progress"}', '1 day'),
    ('sam@cocon.dev', '17000',  'rated',    '{"rating":8}', '3 days'),
    ('alex.gamer@cocon.dev', '113112', 'rated', '{"rating":10}', '5 hours'),
    ('alex.gamer@cocon.dev', '119133', 'status', '{"status":"in_progress"}', '2 days')
) AS v(email, external_id, kind, payload, ago)
JOIN users u ON u.email = v.email
JOIN items i ON i.source = 'igdb' AND i.external_id = v.external_id
JOIN user_items ui ON ui.user_id = u.id_user AND ui.item_id = i.id_item;

-- Lea commente la fiche Hades du compte de démo
INSERT INTO entry_comments (user_item_id, author_id, body)
SELECT ui.id_user_item, lea.id_user, 'Tellement d''accord, et la musique de Darren Korb !'
FROM user_items ui
JOIN users owner ON owner.id_user = ui.user_id AND owner.email = 'alex.gamer@cocon.dev'
JOIN items i ON i.id_item = ui.item_id AND i.source = 'igdb' AND i.external_id = '113112'
CROSS JOIN (SELECT id_user FROM users WHERE email = 'lea@cocon.dev') lea;

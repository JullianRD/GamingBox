-- ============================================================================
-- SEEDER 09 : BIBLIOTHÈQUE COCON (modèle générique)
-- Quelques œuvres, entrées, une liste perso et des personnages pour le
-- premier utilisateur de démo.
-- ============================================================================
SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO items (item_type, source, external_id, title, release_date, cover_url, genres) VALUES
    ('game', 'igdb', '1942',   'The Witcher 3: Wild Hunt', DATE '2015-05-19', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg', '{RPG}'),
    ('game', 'igdb', '113112', 'Hades',                    DATE '2020-09-17', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co39vc.jpg', '{Roguelike,Action}'),
    ('game', 'igdb', '119133', 'Elden Ring',               DATE '2022-02-25', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg', '{RPG}'),
    ('game', 'igdb', '26758',  'Hollow Knight',            DATE '2017-02-24', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg', '{Metroidvania}'),
    ('game', 'igdb', '17000',  'Stardew Valley',           DATE '2016-02-26', 'https://images.igdb.com/igdb/image/upload/t_cover_big/xrpmydnu9rpxvxfjkiu7.jpg', '{Simulation}'),
    ('game', 'igdb', '205780', 'Baldur''s Gate 3',         DATE '2023-08-03', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg', '{RPG,Tactique}')
ON CONFLICT (source, external_id) DO NOTHING;

WITH u AS (SELECT id_user FROM users WHERE email = 'alex.gamer@cocon.dev')
INSERT INTO user_items (user_id, item_id, status, rating, review, is_favorite)
SELECT u.id_user, i.id_item, v.status::entry_status_enum, v.rating, v.review, v.favorite
FROM u
JOIN (VALUES
    ('113112', 'completed',   10, 'Une boucle parfaite, chaque run raconte quelque chose.', true),
    ('119133', 'in_progress', 9,  NULL, false),
    ('1942',   'completed',   9,  'Les quêtes secondaires valent la principale.', true),
    ('26758',  'in_progress', NULL, NULL, false),
    ('17000',  'planned',     NULL, NULL, false),
    ('205780', 'paused',      8,  NULL, false)
) AS v(external_id, status, rating, review, favorite) ON true
JOIN items i ON i.source = 'igdb' AND i.external_id = v.external_id
ON CONFLICT (user_id, item_id) DO NOTHING;

WITH u AS (SELECT id_user FROM users WHERE email = 'alex.gamer@cocon.dev')
INSERT INTO lists (user_id, title, slug, item_type)
SELECT id_user, 'Mes jeux préférés', 'mes-jeux-preferes', 'game' FROM u
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO list_items (list_id, item_id, position)
SELECT l.id_list, i.id_item, v.position
FROM lists l
JOIN users u ON u.id_user = l.user_id AND u.email = 'alex.gamer@cocon.dev'
JOIN (VALUES ('113112', 0), ('1942', 1), ('26758', 2)) AS v(external_id, position) ON true
JOIN items i ON i.source = 'igdb' AND i.external_id = v.external_id
WHERE l.slug = 'mes-jeux-preferes'
ON CONFLICT DO NOTHING;

-- Personnages de Hades (évite l'appel IGDB en démo)
INSERT INTO entities (entity_kind, source, external_id, name) VALUES
    ('character', 'igdb', 'seed-zagreus', 'Zagreus'),
    ('character', 'igdb', 'seed-megaera', 'Mégère'),
    ('character', 'igdb', 'seed-thanatos', 'Thanatos'),
    ('character', 'igdb', 'seed-nyx', 'Nyx'),
    ('character', 'igdb', 'seed-hades', 'Hadès'),
    ('character', 'igdb', 'seed-cerbere', 'Cerbère')
ON CONFLICT DO NOTHING;

INSERT INTO item_entities (item_id, entity_id, position)
SELECT i.id_item, e.id_entity, row_number() OVER (ORDER BY e.created_at)
FROM items i JOIN entities e ON e.external_id LIKE 'seed-%'
WHERE i.source = 'igdb' AND i.external_id = '113112'
ON CONFLICT DO NOTHING;

UPDATE items SET metadata = metadata || '{"entitiesFetchedAt": "seed"}'
WHERE source = 'igdb' AND external_id = '113112';

INSERT INTO user_favorite_entities (user_id, entity_id, item_id)
SELECT u.id_user, e.id_entity, i.id_item
FROM users u, entities e, items i
WHERE u.email = 'alex.gamer@cocon.dev' AND e.external_id IN ('seed-thanatos', 'seed-nyx')
  AND i.source = 'igdb' AND i.external_id = '113112'
ON CONFLICT DO NOTHING;

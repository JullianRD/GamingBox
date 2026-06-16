SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO review_tags (
    id_tag,
    id_review,
    created_at
)
SELECT
    t.id_tag,
    r.id_review,
    NOW() - INTERVAL '2 days'
FROM tags t
JOIN reviews r ON r.slug = 'une-claque-narrative'
WHERE t.tag_name = 'RPG'
ON CONFLICT (id_tag, id_review) DO NOTHING;

INSERT INTO review_tags (
    id_tag,
    id_review,
    created_at
)
SELECT
    t.id_tag,
    r.id_review,
    NOW() - INTERVAL '1 day'
FROM tags t
JOIN reviews r ON r.slug = 'un-open-world-dense'
WHERE t.tag_name = 'Coop'
ON CONFLICT (id_tag, id_review) DO NOTHING;


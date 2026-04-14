SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO shares (
    id_share,
    user_id,
    review_id,
    recipient_email,
    share_token,
    access_config,
    created_at,
    updated_at
)
SELECT
    '99991111-1111-7111-8111-111111111111',
    u.id_user,
    r.id_review,
    'ami.one@example.com',
    'share_tok_alex_001',
    '{"level":"read","allow_download":false,"max_views":10,"view_count":0}'::jsonb,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '2 days'
FROM users u
JOIN reviews r ON r.user_id = u.id_user
WHERE u.email = 'alex.gamer@gamingbox.dev'
  AND r.slug = 'une-claque-narrative'
ON CONFLICT (id_share) DO NOTHING;

INSERT INTO shares (
    id_share,
    user_id,
    review_id,
    recipient_email,
    share_token,
    access_config,
    created_at,
    updated_at
)
SELECT
    '99992222-2222-7222-8222-222222222222',
    u.id_user,
    r.id_review,
    'ami.two@example.com',
    'share_tok_sara_001',
    '{"level":"read","allow_download":true,"max_views":25,"view_count":0}'::jsonb,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
FROM users u
JOIN reviews r ON r.user_id = u.id_user
WHERE u.email = 'sara.console@gamingbox.dev'
  AND r.slug = 'un-open-world-dense'
ON CONFLICT (id_share) DO NOTHING;


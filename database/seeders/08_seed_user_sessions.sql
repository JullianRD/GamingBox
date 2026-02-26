SET CLIENT_ENCODING TO 'UTF8';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_session'
    ) THEN
        INSERT INTO user_session (sid, sess, expire) VALUES
            (
                'sess_alex_001',
                '{"cookie":{"maxAge":86400000},"user_id":"11111111-1111-7111-8111-111111111111","role":"customer"}',
                NOW() + INTERVAL '1 day'
            ),
            (
                'sess_sara_001',
                '{"cookie":{"maxAge":86400000},"user_id":"22222222-2222-7222-8222-222222222222","role":"customer"}',
                NOW() + INTERVAL '1 day'
            )
        ON CONFLICT (sid) DO NOTHING;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_sessions'
    ) THEN
        INSERT INTO user_sessions (sid, sess, expire) VALUES
            (
                'sess_alex_001',
                '{"cookie":{"maxAge":86400000},"user_id":"11111111-1111-7111-8111-111111111111","role":"customer"}',
                NOW() + INTERVAL '1 day'
            ),
            (
                'sess_sara_001',
                '{"cookie":{"maxAge":86400000},"user_id":"22222222-2222-7222-8222-222222222222","role":"customer"}',
                NOW() + INTERVAL '1 day'
            )
        ON CONFLICT (sid) DO NOTHING;
    END IF;
END $$;

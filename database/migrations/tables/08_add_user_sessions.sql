--database/migrations/table/08_add_user_sessions_table.sql

SET CLIENT_ENCODING TO 'UTF8';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
        CREATE TABLE user_sessions (
            sid VARCHAR PRIMARY KEY,
            sess JSON NOT NULL,
            expire TIMESTAMP(6) NOT NULL
        );
        CREATE INDEX "idx_user_sessions_expire" ON user_sessions(expire);
        RAISE NOTICE 'Table "user_sessions" créée.';
        END IF;
END
$$;

        
        --Cette table sert à stocker les sessions des utilisateurs côté serveur.

        --Quand un utilisateur se connecte :

-- Le serveur crée une session
-- Cette session contient des infos temporaires (ex : user_id, rôle, panier, préférences)
-- La session est associée à un identifiant unique (sid)
-- La session a une date d’expiration (expire)
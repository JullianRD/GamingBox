-- ============================================================================
-- TODO ÉTAPE 2 (DCL) : SÉCURISATION ET RÔLES (à exécuter avec le rôle postgres)
-- ============================================================================

-- Création du rôle applicatif avec droits restreints (jamais se connecter avec postgres !)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_gamingbox') THEN
        CREATE ROLE app_gamingbox WITH LOGIN PASSWORD 'unpandarouxquidort';
    END IF;
END
$$;

-- On donne les accès à ce rôle sur la base de données
GRANT CONNECT ON DATABASE gamingbox_db_dev TO app_gamingbox;

-- On se connecter à la base de données app_gamingbox_dev

-- Ce script :

-- Crée un utilisateur PostgreSQL dédié à ton application
-- Lui permet de se connecter à ta base
-- Évite d’utiliser le super-admin postgres
-- Pose la base d’une architecture sécurisée
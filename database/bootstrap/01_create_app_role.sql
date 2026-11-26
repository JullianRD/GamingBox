-- ============================================================================
-- BOOTSTRAP 01 : rôle applicatif (à exécuter avec un rôle administrateur)
-- ============================================================================
-- Le mot de passe n'est plus écrit en dur : il est passé par psql
--   psql -v app_role=app_cocon -v app_password="$DB_APP_PASSWORD" -v db_name=cocon_db_dev -f ...
-- scripts/init_db.sh le fait à partir du .env.

SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L', :'app_role', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'app_role')
\gexec

-- ============================================================================
-- SUPPRESSION DE TOUTES LES TABLES DE LA BASE DE DONNEES

-- Ajoutez ici les tables que vous souhaitez supprimer de la base de données
-- ============================================================================

DROP TABLE IF EXISTS review_likes CASCADE;
DROP TABLE IF EXISTS user_follows CASCADE;
DROP TABLE IF EXISTS game_list_items CASCADE;
DROP TABLE IF EXISTS game_lists CASCADE;
DROP TABLE IF EXISTS auth_tokens CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
DROP TABLE IF EXISTS review_tags CASCADE;
DROP TABLE IF EXISTS shares CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS app_events CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS games CASCADE;
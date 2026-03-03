-- ============================================================================
-- GamingBox - Base de données principale
-- Version: 1.0.0
-- Date: 2026-02-26
-- Description: Liste de jeu vidéo personalisé
-- ============================================================================

-- ============================================================================
-- TODO ÉTAPE 1 (DCL/DDL) : CRÉATION DE LA BASE DE DONNÉES (à exécuter avec le rôle postgres)
-- ============================================================================

-- Création de la base avec support UTF8 complet

CREATE DATABASE app_gamingbox_dev WITH ENCODING = 'UTF8';

COMMENT ON DATABASE app_gamingbox_dev IS 'Base de données principale du projet GamingBox - Coffre-fort numérique';
-- ============================================================================
-- TODO ÉTAPE 3-B : TYPES ÉNUMÉRÉS (ENUM) (à exécuter avec le rôle postgres)
-- ============================================================================

-- ! Important : Si vous ajoutez une nouvelle valeur dans un type,il faut le supprimer et le recréer !

-- Forcer l'encodage client
SET CLIENT_ENCODING TO 'UTF8';

-- Rôles utilisateurs (Access Control Level)
CREATE TYPE role_enum AS ENUM(
    'admin',         -- Gestion des utilisateurs et des droits
    'customer',      -- Utilisateur normal
    'visiteur',      -- Simple visiteur sans droit
    'super_admin'    -- Gestion des droits système
);

COMMENT ON TYPE role_enum IS 'Rôles des utilisateurs pour la gestion des droits Access Controle Level (ACL)';

-- Fournisseurs d'authentification
CREATE TYPE auth_provider_enum AS ENUM(
    'local',        -- Authentification locale
    'google',       -- Authentification Google
    'azure',        -- Authentification Azure
    'apple'         -- Authentification Apple
);
COMMENT ON TYPE auth_provider_enum IS 'Fournisseur d authentification';

CREATE TYPE progression_status_enum AS ENUM(
    'En cour',
    'Terminé',
    'Whislist',
    'Dropped'
);

COMMENT ON TYPE progression_status_enum IS 'Status du jeu ajouté dans la review par l utilisateur';

CREATE TYPE game_platforme_enum AS ENUM(
    'PC',
    'Console de jeu',
    'Autre'
);

COMMENT ON TYPE game_platforme_enum IS 'Platforme de jeu sur laquelle le joueur à joué pour le jeu de sa review';

CREATE TYPE event_category_enum AS ENUM (
    'analytics',   -- Événements métier (login, création review...)
    'audit',       -- Audit trail (modification compte, suppression...)
    'monitoring',  -- Health checks, performance
    'gdpr'         -- Événements RGPD (export, suppression, consentement...)
);

COMMENT ON TYPE event_category_enum IS 'Catégories principales des événements système';

CREATE TYPE severity_enum AS ENUM (
    'info',        -- Information normale
    'warning',     -- Avertissement (ex: tentative de login échouée)
    'error',       -- Erreur récupérable (ex: validation échouée)
    'critical'     -- Erreur critique (ex: base de données inaccessible)
);

COMMENT ON TYPE severity_enum IS 'Niveaux de gravité pour les événements de type monitoring/audit';
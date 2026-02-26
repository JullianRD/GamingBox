-- migration/config/02_add_permissions_role_app.sql
-- À exécuter APRES la création de toutes les tables

-- On donne l'accès au schéma
GRANT USAGE ON SCHEMA public TO app_gamingbox;

-- On donne les droits sur les tables existantes (Lecture / Écriture)
GRANT
SELECT, INSERT,
UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_gamingbox;

-- On donne les droits sur les séquences (indispensable pour les IDs auto-incrémentés ou UUIDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_gamingbox;

-- Sécurité pour les tables créées dans le futur
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT
SELECT, INSERT,
UPDATE, DELETE ON TABLES TO app_gamingbox;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE,
SELECT ON SEQUENCES TO app_gamingbox;

-- Ce fichier fait 4 choses :

-- Autorise l’accès au schéma
-- Donne les droits CRUD sur les tables existantes
-- Donne les droits sur les séquences (sinon INSERT casse)
-- Automatise les droits pour toutes les futures tables


-- Résultat : 

-- 👑 postgres → super admin (jamais utilisé par l’app)
-- 🧑‍💻 app_gamingbox → rôle applicatif sécurisé
-- 🔐 Permissions limitées au strict nécessaire
-- 🚀 Compatible prod


-- Le role app_gamingbox est la pour le backend et postgreSQL, pas pour un humain, ce n'est pas un role applicatif, on le fait pour la sécurité de la base de données
-- Si un hacker :
-- Trouve une faille SQL
-- Ou exploite une injection
-- Il ne pourra faire que ce que app_gamingbox a le droit de faire.
-- Il ne pourra pas :
-- Supprimer la base
-- Créer des rôles
-- Supprimer toutes les permissions
-- Drop le schéma
-- Donc tu limites les dégâts.
-- Imagine ton backend comme un employé.
-- postgres = le PDG
-- app_gamingbox = un employé avec accès limité
-- admin dans ta table users = manager dans ton application



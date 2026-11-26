#!/usr/bin/env bash

# ============================================
# COCON - Initialisation de la base locale
# ============================================
# 1. Crée la base et le rôle applicatif (bootstrap, rôle administrateur)
# 2. Applique le schéma via les migrations versionnées (migrations/)
# 3. Donne les droits au rôle applicatif
# 4. Propose d'insérer les données de test

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f .env ]; then
    echo -e "${RED}Erreur : fichier .env introuvable${NC}"
    exit 1
fi

export $(grep -v '^#' .env | xargs)

DB_SUPERUSER=${DB_SUPERUSER:-postgres}
DB_APP_USER=${DB_APP_USER:-app_cocon}
DB_NAME=${DB_NAME:-cocon_db_dev}

if [ -z "$DB_APP_PASSWORD" ]; then
    echo -e "${RED}Erreur : DB_APP_PASSWORD manquant dans le .env${NC}"
    exit 1
fi

PSQL_VARS=(-v ON_ERROR_STOP=1 -v app_role="$DB_APP_USER" -v app_password="$DB_APP_PASSWORD" -v db_name="$DB_NAME")

echo -e "${GREEN}Phase 1 : base et rôle applicatif${NC}"
psql -U "$DB_SUPERUSER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME" || createdb -U "$DB_SUPERUSER" "$DB_NAME"
psql "${PSQL_VARS[@]}" -U "$DB_SUPERUSER" -d "$DB_NAME" -f database/bootstrap/01_create_app_role.sql

echo -e "\n${GREEN}Phase 2 : migrations${NC}"
npm run db:migrate

echo -e "\n${GREEN}Phase 3 : droits du rôle applicatif${NC}"
psql "${PSQL_VARS[@]}" -U "$DB_SUPERUSER" -d "$DB_NAME" -f database/bootstrap/02_grant_app_role.sql

echo -e "\n${GREEN}Phase 4 : données de test${NC}"
printf "Insérer les données de test ? (y/N) : "
read -r reply
if [[ $reply =~ ^[YyOo]$ ]]; then
    for file in $(find database/seeders -maxdepth 1 -name "*.sql" | sort); do
        echo -e "${YELLOW}➜${NC} $(basename "$file")"
        psql -v ON_ERROR_STOP=1 -U "$DB_SUPERUSER" -d "$DB_NAME" -f "$file"
    done
fi

echo -e "\n${GREEN}Base $DB_NAME prête.${NC}"

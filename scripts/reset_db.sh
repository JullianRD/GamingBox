#!/usr/bin/env bash

# ============================================
# COCON - DB Reset Script (Local)
# ============================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Chargement des variables d'environnement
# ----------------------------------------
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    DB_USER=${DB_USER:-postgres}
    DB_NAME=${DB_NAME:-cocon_db_dev}
else
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    exit 1
fi

echo -e "${RED}⚠️  DANGER ZONE: Database Reset${NC}\n"

# 2. Vérification: Est-ce que la base existe déjà ?
# ----------------------------------------
DB_EXISTS=$(psql -lqt -U "$DB_USER" | cut -d \| -f 1 | grep -qw "$DB_NAME" && echo "yes" || echo "no")

if [ "$DB_EXISTS" = "no" ]; then
    echo -e "${YELLOW}🤔 Database '$DB_NAME' does not exist.${NC}"
    echo -e "Cannot reset a missing database, but we can initialize it."

    printf "${GREEN}Would you like to run the initialization now? (y/N): ${NC}"
    read -r INSTALL_REPLY

    if [[ "$INSTALL_REPLY" =~ ^[OoYy]$ ]]; then
        echo -e "\n${GREEN}🚀 Starting init_db.sh...${NC}"
        bash ./scripts/init_db.sh
        exit 0
    else
        echo "Operation cancelled."
        exit 0
    fi
fi

# 3. Confirmation de suppression (Sécurité)
# ----------------------------------------
echo -e "${YELLOW}This will DROP all tables and data from: ${RED}$DB_NAME${NC}"
printf "Are you sure? (type 'RESET' to confirm): "
read -r REPLY

if [ "$REPLY" != "RESET" ]; then
    echo -e "${GREEN}✓ Reset cancelled.${NC}"
    exit 0
fi

# 4. Phase de nettoyage : on annule toutes les migrations
# ----------------------------------------
echo -e "${RED}Phase 1 : annulation des migrations${NC}"
npm run db:migrate:down -- 0

echo -e "${GREEN}✓ Database cleaned successfully.${NC}\n"

# 5. Proposition de ré-installation
# ----------------------------------------
printf "${YELLOW}Would you like to re-initialize the database now? (y/N): ${NC}"
read -r REINIT

if [[ "$REINIT" =~ ^[OoYy]$ ]]; then
    echo -e "\n${GREEN}🚀 Re-initializing...${NC}"
    bash ./scripts/init_db.sh
else
    echo -e "${GREEN}Done. The database is now empty.${NC}"
fi

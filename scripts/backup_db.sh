#!/usr/bin/env bash
# Sauvegarde logique de la base (format custom compressé de pg_dump).
#
# Usage :   scripts/backup_db.sh [dossier]      (défaut : ./backups)
# Variables : DATABASE_URL (lue depuis l'environnement ou .env)
# Rétention : BACKUP_KEEP (défaut 14) fichiers les plus récents conservés.
#
# Planification (cron, tous les jours à 03h10) :
#   10 3 * * * cd /chemin/vers/GamingBox && scripts/backup_db.sh >> logs/backup.log 2>&1
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
fi
: "${DATABASE_URL:?DATABASE_URL manquante}"

DEST="${1:-./backups}"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$DEST"
chmod 700 "$DEST"

FILE="$DEST/gamingbox-$(date +%Y%m%d-%H%M%S).dump"
umask 077
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE"

# Vérifie que l'archive est lisible avant de la considérer valide
pg_restore --list "$FILE" > /dev/null
echo "Sauvegarde OK : $FILE ($(du -h "$FILE" | cut -f1))"

# Rétention : ne garde que les $KEEP plus récentes
ls -1t "$DEST"/gamingbox-*.dump | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -- "$old"
  echo "Ancienne sauvegarde supprimée : $old"
done

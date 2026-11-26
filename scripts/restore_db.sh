#!/usr/bin/env bash
# Restaure une sauvegarde dans une base CIBLE (à créer au préalable).
#
# Usage : scripts/restore_db.sh <fichier.dump> <url_base_cible>
# Exemple de test de restauration (à faire régulièrement) :
#   createdb gamingbox_restore_test
#   scripts/restore_db.sh backups/gamingbox-20260101-031000.dump postgresql://postgres@localhost/gamingbox_restore_test
#
# Sécurité : refuse d'écraser la base désignée par DATABASE_URL.
set -euo pipefail

FILE="${1:?Usage: restore_db.sh <fichier.dump> <url_base_cible>}"
TARGET="${2:?Usage: restore_db.sh <fichier.dump> <url_base_cible>}"

if [ "$TARGET" = "${DATABASE_URL:-}" ]; then
  echo "Refus : la cible est la base applicative courante. Restaure d'abord dans une base de test." >&2
  exit 1
fi

pg_restore --list "$FILE" > /dev/null
pg_restore --no-owner --exit-on-error --dbname="$TARGET" "$FILE"
echo "Restauration terminée dans : $TARGET"
psql "$TARGET" -Atc "SELECT 'users=' || COUNT(*) FROM users" || true

#!/usr/bin/env bash
# Daily backup of the shop database.
#
# The shop's entire financial history lives in this one database — losing it is
# worse than losing the paper notebook, because there is no carbon copy.
# Schedule this with cron, e.g.:
#   0 21 * * * /path/to/mobile-repair-shop-backend/scripts/backup.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

# Read ONLY the DB_* settings out of .env.
# (Sourcing the whole file would execute comment text containing spaces.)
read_env() {
  local key="$1" default="${2-}"
  local value
  value=$(grep -E "^${key}=" "$APP_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2-)
  echo "${value:-$default}"
}

DB_NAME=$(read_env DB_NAME mobile_repair_shop)
DB_USER=$(read_env DB_USER postgres)
DB_PASSWORD=$(read_env DB_PASSWORD)
DB_HOST=$(read_env DB_HOST localhost)
DB_PORT=$(read_env DB_PORT 5432)

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F_%H%M)
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
  | gzip > "$OUT"

echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Prune old backups.
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
echo "Pruned backups older than $KEEP_DAYS days."

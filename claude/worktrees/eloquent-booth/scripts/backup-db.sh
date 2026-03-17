#!/usr/bin/env bash
# Backs up the encrypted SQLite dev database
# Keeps last 10 backups, stores in db/backups/

set -euo pipefail

DB_PATH="${SQLITE_PATH:-./db/dev.db}"
BACKUP_DIR="./db/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dev-${TIMESTAMP}.db.enc"
MAX_BACKUPS=10

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found at $DB_PATH — skipping backup."
  exit 0
fi

cp "$DB_PATH" "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# Prune old backups beyond MAX_BACKUPS
cd "$BACKUP_DIR"
ls -1t *.db.enc 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null || true
echo "Retained last $MAX_BACKUPS backups."

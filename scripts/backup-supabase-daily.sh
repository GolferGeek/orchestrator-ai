#!/bin/bash

# Daily Supabase Database Backup Script
# Creates timestamped backups of the local Supabase database

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./storage/backups}"
SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-127.0.0.1}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-7012}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/golfergeek_supabase_backup_$TIMESTAMP.sql"

echo "Creating Supabase backup: $BACKUP_FILE"

# Create the backup using Docker container to avoid version mismatch
docker exec supabase_db_api-dev pg_dump \
  --host=localhost \
  --port=5432 \
  --username="$SUPABASE_DB_USER" \
  --dbname="$SUPABASE_DB_NAME" \
  --verbose \
  --clean \
  --if-exists \
  --create \
  --format=plain \
  > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

echo "Backup created successfully: $BACKUP_FILE"
echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Keep only the last 7 days of backups
find "$BACKUP_DIR" -name "golfergeek_supabase_backup_*.sql.gz" -type f -mtime +7 -delete

echo "Old backups cleaned up (kept last 7 days)"

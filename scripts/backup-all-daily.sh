#!/bin/bash

# Daily Backup Script for All Databases
# Runs both Supabase and n8n backups

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting daily backup process..."
echo "Project root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# Run Supabase backup
echo "=== Running Supabase backup ==="
bash "$SCRIPT_DIR/backup-supabase-daily.sh"

echo ""

# Run n8n backup
echo "=== Running n8n backup ==="
bash "$SCRIPT_DIR/backup-n8n-daily.sh"

echo ""
echo "=== Daily backup process completed ==="

# List recent backups
echo "Recent backups:"
ls -la storage/backups/ | tail -10

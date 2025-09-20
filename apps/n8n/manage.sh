#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-orchestrator_n8n}
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

load_root_env() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    local root_env="$REPO_ROOT/.env"
    if [[ -f "$root_env" ]]; then
      # shellcheck disable=SC1090
      set +u
      set -a
      source "$root_env"
      set +a
      set -u
    fi
  fi
}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <up|down|restart|logs|ps> [docker compose args]

Wraps docker compose with the environment required for n8n.
USAGE
}

require_database_url() {
  load_root_env
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is not set. Ensure your root .env is loaded before calling this script." >&2
    echo "Hint: run 'set -a; source .env; set +a' from the repo root before invoking apps/n8n/manage.sh." >&2
    exit 1
  fi
}

export_postgres_env() {
  require_database_url
  # shellcheck disable=SC2046
  eval $(python3 <<'PY'
import os, shlex, sys
from urllib.parse import urlparse, parse_qs

url = os.environ.get('DATABASE_URL', '')
parsed = urlparse(url)
if not parsed.hostname:
    sys.stderr.write('Invalid DATABASE_URL, unable to parse host.\n')
    sys.exit(1)
hostname = parsed.hostname.lower()
if hostname in {'localhost', '127.0.0.1'}:
    hostname = 'host.docker.internal'

username = parsed.username or ''
password = parsed.password or ''
port = parsed.port or 5432
# Remove leading slash from path to get database name
dbname = parsed.path.lstrip('/') or ''
query = parse_qs(parsed.query)
sslmode = (query.get('sslmode', [''])[0] or '').lower()

def export_kv(key, value):
    if not value:
        return
    print(f"export {key}={shlex.quote(str(value))}")

export_kv('DB_POSTGRESDB_HOST', hostname)
export_kv('DB_POSTGRESDB_PORT', port)
export_kv('DB_POSTGRESDB_DATABASE', dbname)
export_kv('DB_POSTGRESDB_USER', username)
export_kv('DB_POSTGRESDB_PASSWORD', password)
export_kv('DB_POSTGRESDB_SCHEMA', os.environ.get('N8N_DB_SCHEMA', 'public'))
# Respect any pre-set SSL flags before inferring from the URL
if 'DB_POSTGRESDB_SSL' not in os.environ:
    export_kv('DB_POSTGRESDB_SSL', 'true' if sslmode in {'require', 'verify-ca', 'verify-full'} else 'false')
if 'DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED' not in os.environ:
    # Supabase requires SSL but uses a public certificate chain, allow opt-out for development
    export_kv('DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED', 'false' if sslmode else 'true')
PY
)
}

run_compose() {
  local action="$1"
  shift || true

  case "$action" in
    up|down|restart|logs|ps)
      export_postgres_env
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  case "$action" in
    up)
      COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker compose -f "$COMPOSE_FILE" up -d "$@"
      ;;
    down)
      COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker compose -f "$COMPOSE_FILE" down "$@"
      ;;
    restart)
      COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker compose -f "$COMPOSE_FILE" restart "$@"
      ;;
    logs)
      COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker compose -f "$COMPOSE_FILE" logs "$@"
      ;;
    ps)
      COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker compose -f "$COMPOSE_FILE" ps "$@"
      ;;
  esac
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

action="$1"
shift
run_compose "$action" "$@"

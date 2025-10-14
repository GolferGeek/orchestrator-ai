#!/bin/bash

# Simple n8n management script
# Just ensures n8n is running - no environment complexity

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-orchestrator_n8n}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run docker-compose commands
run_compose() {
    cd "$SCRIPT_DIR"
    # Load environment variables from n8n-specific .env file
    if [ -f ".env" ]; then
        echo "Loading n8n environment from .env"
        set -a
        source .env
        set +a
    else
        echo "No .env file found in n8n directory"
        exit 1
    fi
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose -f "$COMPOSE_FILE" "$@"
}

# Function to check if n8n is running
check_n8n_running() {
    if /Applications/Docker.app/Contents/Resources/bin/docker ps --format "table {{.Names}}" | grep -q "^orchestrator-n8n$"; then
        return 0
    else
        return 1
    fi
}

# Function to start n8n if not running
ensure_n8n_running() {
    if check_n8n_running; then
        echo -e "${GREEN}✅ n8n is already running on http://localhost:5678${NC}"
        return 0
    else
        echo -e "${YELLOW}Starting n8n...${NC}"
        run_compose up -d
        echo -e "${GREEN}✅ n8n started on http://localhost:5678${NC}"
        return 0
    fi
}

# Main logic
case "${1:-up}" in
    up|start)
        ensure_n8n_running
        ;;
    down|stop)
        echo -e "${YELLOW}Stopping n8n...${NC}"
        run_compose down
        echo -e "${GREEN}✅ n8n stopped${NC}"
        ;;
    restart)
        echo -e "${YELLOW}Restarting n8n...${NC}"
        run_compose restart
        echo -e "${GREEN}✅ n8n restarted${NC}"
        ;;
    logs)
        run_compose logs "${@:2}"
        ;;
    ps|status)
        run_compose ps
        ;;
    *)
        echo "Usage: $0 {up|down|restart|logs|ps}"
        echo "  up/start  - Start n8n if not running (default)"
        echo "  down/stop - Stop n8n"
        echo "  restart   - Restart n8n"
        echo "  logs      - Show n8n logs"
        echo "  ps/status - Show n8n status"
        exit 1
        ;;
esac
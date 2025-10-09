#!/bin/bash

# Import Requirements Writer N8N Workflow
# This script imports the requirements writer workflow into N8N

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_FILE="$SCRIPT_DIR/../workflows/requirements-writer-workflow.json"
N8N_BASE_URL="http://localhost:5678"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Importing Requirements Writer N8N Workflow${NC}"

# Check if N8N is running
if ! curl -s "$N8N_BASE_URL" > /dev/null; then
    echo -e "${RED}❌ N8N is not running on $N8N_BASE_URL${NC}"
    echo -e "${YELLOW}Please start N8N first:${NC}"
    echo "  cd $SCRIPT_DIR/.. && ./manage.sh up"
    exit 1
fi

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo -e "${RED}❌ Workflow file not found: $WORKFLOW_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ N8N is running${NC}"
echo -e "${GREEN}✅ Workflow file found${NC}"

# Import workflow using N8N API
echo -e "${YELLOW}📥 Importing workflow...${NC}"

# Get N8N API key (you'll need to set this in your environment)
if [ -z "$N8N_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  N8N_API_KEY not set. You'll need to manually import the workflow.${NC}"
    echo -e "${BLUE}📋 Manual Import Instructions:${NC}"
    echo "1. Open N8N at http://localhost:5678"
    echo "2. Click 'Import from file'"
    echo "3. Select: $WORKFLOW_FILE"
    echo "4. Click 'Import'"
    echo ""
    echo -e "${BLUE}📄 Workflow file location:${NC} $WORKFLOW_FILE"
    exit 0
fi

# Import via API
RESPONSE=$(curl -s -X POST \
  "$N8N_BASE_URL/api/v1/workflows/import" \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -d @"$WORKFLOW_FILE")

if echo "$RESPONSE" | grep -q '"id"'; then
    echo -e "${GREEN}✅ Workflow imported successfully!${NC}"
    echo -e "${BLUE}🌐 Open N8N:${NC} $N8N_BASE_URL"
    echo -e "${BLUE}📋 Webhook URL:${NC} $N8N_BASE_URL/webhook/requirements"
else
    echo -e "${RED}❌ Failed to import workflow${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo -e "${YELLOW}📋 Manual Import Instructions:${NC}"
    echo "1. Open N8N at http://localhost:5678"
    echo "2. Click 'Import from file'"
    echo "3. Select: $WORKFLOW_FILE"
    echo "4. Click 'Import'"
fi

echo -e "${GREEN}🎉 Requirements Writer N8N Workflow ready!${NC}"


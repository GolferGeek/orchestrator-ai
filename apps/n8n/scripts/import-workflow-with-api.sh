#!/bin/bash

# Import Requirements Writer N8N Workflow using API
# This script imports the workflow using the configured N8N API key

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_FILE="$SCRIPT_DIR/../workflows/requirements-writer-enhanced.json"
N8N_ENV_FILE="$SCRIPT_DIR/../.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Importing Requirements Writer N8N Workflow via API${NC}"

# Load environment variables
if [ -f "$N8N_ENV_FILE" ]; then
    source "$N8N_ENV_FILE"
    echo -e "${GREEN}✅ Loaded N8N environment from .env${NC}"
else
    echo -e "${RED}❌ .env file not found: $N8N_ENV_FILE${NC}"
    exit 1
fi

# Check if API key is set
if [ -z "$N8N_API_KEY" ]; then
    echo -e "${RED}❌ N8N_API_KEY not set in .env${NC}"
    exit 1
fi

N8N_BASE_URL="${N8N_PROTOCOL}://${N8N_API_URL}"

# Check if N8N is running
if ! curl -s "$N8N_BASE_URL" > /dev/null; then
    echo -e "${RED}❌ N8N is not running on $N8N_BASE_URL${NC}"
    echo -e "${YELLOW}Please start N8N first:${NC}"
    echo "  cd $SCRIPT_DIR/.. && ./manage.sh up"
    exit 1
fi

echo -e "${GREEN}✅ N8N is running at $N8N_BASE_URL${NC}"

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo -e "${RED}❌ Workflow file not found: $WORKFLOW_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Workflow file found${NC}"

# Import workflow using N8N API
echo -e "${YELLOW}📥 Importing workflow via API...${NC}"

RESPONSE=$(curl -s -X POST \
  "$N8N_BASE_URL/api/v1/workflows" \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -d @"$WORKFLOW_FILE")

# Check if import was successful
if echo "$RESPONSE" | grep -q '"id"'; then
    WORKFLOW_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
    echo -e "${GREEN}✅ Workflow imported successfully!${NC}"
    echo -e "${BLUE}🆔 Workflow ID: $WORKFLOW_ID${NC}"
    echo -e "${BLUE}🌐 Open N8N: $N8N_BASE_URL${NC}"
    echo -e "${BLUE}📋 Edit Workflow: $N8N_BASE_URL/workflow/$WORKFLOW_ID${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Next Steps:${NC}"
    echo "1. Open the workflow in N8N"
    echo "2. Activate the workflow"
    echo "3. Note the webhook URL"
    echo "4. Test with: ./scripts/test-requirements-workflow.sh"
else
    echo -e "${RED}❌ Failed to import workflow${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo -e "${YELLOW}📋 Manual Import Instructions:${NC}"
    echo "1. Open N8N at $N8N_BASE_URL"
    echo "2. Click 'Import from file'"
    echo "3. Select: $WORKFLOW_FILE"
    echo "4. Click 'Import'"
fi

echo -e "${GREEN}🎉 Requirements Writer N8N Workflow ready!${NC}"



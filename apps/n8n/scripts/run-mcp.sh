#!/bin/bash
# Wrapper script to run n8n MCP with proper environment variables

# Load n8n environment variables
if [ -f "apps/n8n/.env" ]; then
  export $(grep -v '^#' apps/n8n/.env | xargs)
fi

# Run the n8n MCP server
npx n8n-mcp

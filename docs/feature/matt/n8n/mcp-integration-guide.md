# n8n MCP Integration Guide

This guide explains how to use the n8n Model Context Protocol (MCP) server to build workflows directly from your codebase using AI assistants.

## Overview

The n8n MCP server provides AI assistants (like Claude/Cursor) with comprehensive access to n8n documentation and workflow building capabilities, allowing you to create complex workflows using natural language descriptions.

## Setup

### 1. Enable n8n API Access

First, you need to set up API access for n8n:

1. **Open n8n UI**: Go to http://localhost:5678
2. **Complete Setup**: If first time, complete the initial setup
3. **Go to Settings**: Click your profile → Settings → API
4. **Create API Key**: Generate a new API key for MCP access

### 2. Add n8n Configuration to .env

Add your n8n API configuration to `apps/n8n/.env`:

```bash
# n8n Configuration
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your-n8n-api-key-here
```

The MCP configuration in `.cursor/mcp.json` uses a wrapper script that loads the n8n environment:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "./apps/n8n/scripts/run-mcp.sh",
      "args": [],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "false"
      }
    }
  }
}
```

The wrapper script (`apps/n8n/scripts/run-mcp.sh`) automatically loads environment variables from `apps/n8n/.env` before starting the MCP server.

**Benefits:**
- ✅ **Secure**: API keys not hardcoded in config files
- ✅ **Team-friendly**: Each developer uses their own API key
- ✅ **Environment-specific**: Different keys for dev/prod

**Note:** The n8n MCP server connects to your n8n instance via its API. The Supabase integration happens through n8n workflows that use Supabase nodes, not directly through the MCP server.

### 3. Test Connection

Use our test script to verify everything is working:

```bash
# Set your API key
export N8N_API_KEY=your-api-key-here

# Run the test script
./apps/n8n/scripts/test-api-connection.sh
```

### 4. Restart Cursor

After updating the MCP configuration, restart Cursor to load the n8n MCP server with Supabase connection.

## Usage

### Basic Workflow Creation

You can describe workflows in natural language and the AI will generate the complete n8n configuration:

```
"Create an n8n workflow that:
1. Triggers on a webhook POST to /api/agent-completed
2. Extracts the agentId and result from the payload
3. Updates the agent status in our Supabase database
4. Sends a notification to Slack if the result is 'success'"
```

### Advanced Workflow Examples

**Data Processing Pipeline:**
```
"Build a workflow that:
1. Monitors a folder for new CSV files
2. Validates the CSV structure
3. Transforms the data (convert dates, normalize names)
4. Inserts records into our PostgreSQL database
5. Moves processed files to an archive folder
6. Sends an email report with processing statistics"
```

**API Integration Workflow:**
```
"Create a workflow that:
1. Runs every hour
2. Fetches data from our external CRM API
3. Compares with our local customer database
4. Creates new customer records for any differences
5. Updates existing records if data has changed
6. Logs all changes to our audit table"
```

## Integration with Our Workflow Sync System

The n8n MCP works seamlessly with our workflow sync system:

### 1. Generate Workflow with AI
Use natural language to describe your workflow. The AI will create the complete n8n workflow JSON.

### 2. Save to Database
Insert the generated workflow into the database:

```sql
INSERT INTO n8n.n8n_workflows (
  name,
  active,
  nodes,
  connections,
  settings
) VALUES (
  'AI Generated Workflow',
  true,
  '[generated_nodes_json]'::jsonb,
  '{generated_connections}'::jsonb,
  '{}'::jsonb
);
```

### 3. Export as Migration
Use our sync system to create a migration:

```bash
npm run n8n:create-migration "AI Generated Workflow"
```

### 4. Share with Team
Commit the migration for team collaboration:

```bash
git add apps/api/supabase/migrations/
git commit -m "feat: add AI-generated workflow for agent completion handling"
git push
```

## Workflow Development Patterns

### Pattern 1: Webhook → Database → Notification
Common for handling external events:
- Webhook trigger
- Data validation
- Database operations
- Notification (Slack/Email)

### Pattern 2: Scheduled → API → Processing → Storage
Common for data synchronization:
- Cron trigger
- External API calls
- Data transformation
- Database storage

### Pattern 3: File → Transform → Multiple Outputs
Common for data processing:
- File system trigger
- Data transformation
- Multiple destination outputs

## Best Practices

### 1. Descriptive Workflow Names
Use clear, descriptive names that explain the workflow's purpose:
- ✅ "Agent Completion Webhook Handler"
- ✅ "Daily CRM Data Sync"
- ❌ "Workflow 1"
- ❌ "Test"

### 2. Include Error Handling
Always ask the AI to include error handling:
```
"Include error handling that:
1. Catches API failures and retries 3 times
2. Logs errors to our database
3. Sends alerts for critical failures"
```

### 3. Environment-Specific Configuration
Use environment variables for configuration:
```
"Use environment variables for:
- Database connection strings
- API keys and secrets
- Webhook URLs
- Notification settings"
```

### 4. Documentation in Workflow
Ask for inline documentation:
```
"Add descriptive notes to each node explaining:
- What the node does
- Expected input format
- Output structure
- Error conditions"
```

## Troubleshooting

### MCP Server Not Responding
1. Restart Cursor
2. Check `.cursor/mcp.json` syntax
3. Verify `npx n8n-mcp` works in terminal

### Generated Workflows Not Working
1. Validate the JSON structure
2. Check node configurations
3. Test with sample data
4. Review error logs in n8n UI

### Database Integration Issues
1. Verify connection strings
2. Check table schemas match expectations
3. Ensure proper permissions
4. Test queries independently

## Advanced Features

### Custom Node Integration
When describing workflows, you can reference custom nodes or specific integrations available in your n8n instance.

### Workflow Templates
Create reusable workflow templates by describing common patterns and saving them as reference workflows.

### Batch Operations
Describe complex batch operations and the AI will create efficient workflows with proper error handling and progress tracking.

## Examples Repository

Save successful AI-generated workflows in `docs/feature/matt/n8n/examples/` for team reference and pattern reuse.

## Integration with Existing Systems

The n8n MCP understands your existing system architecture and can create workflows that integrate with:
- Supabase database tables
- Existing API endpoints
- Authentication systems
- Notification services
- File storage systems

This makes it easy to create workflows that fit naturally into your existing infrastructure.

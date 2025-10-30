# N8n MCP Server

MCP server for interacting with your local N8n instance through Claude Code.

## Setup

1. **Install dependencies:**
   ```bash
   cd mcp-n8n-server
   npm install
   ```

2. **Your N8n configuration is already set up!**
   - Uses your existing `N8N_API_KEY` from the main `.env` file
   - Connects to `http://localhost:5678`

## Usage

### Start the MCP server:
```bash
npm start
```

### Configure in Claude Code MCP settings:

Add this to your MCP configuration:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/Users/Justin/projects/GolferGeek/orchestrator-ai/mcp-n8n-server/index.js"],
      "env": {
        "N8N_WEBHOOK_URL": "http://localhost:5678",
        "N8N_API_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTA0YzJkNi03YmIzLTQ5NmEtYjA0MC03NzI4NzhlNWMwZDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU5OTU3NTM2fQ.3lQmiBaA0xZwIa9y2cIQrJ5PNwXkV7I-eEiYOZx6iBk"
      }
    }
  }
}
```

## Available Functions

Once configured, you'll have access to these N8n functions in Claude Code:

- `list_workflows` - List all workflows
- `get_workflow` - Get specific workflow details  
- `create_workflow` - Create new workflows
- `update_workflow` - Update existing workflows
- `delete_workflow` - Delete workflows
- `execute_workflow` - Run workflows
- `set_workflow_active` - Activate/deactivate workflows
- `get_executions` - Get execution history
- `get_execution` - Get specific execution details
- `test_n8n_connection` - Test N8n connectivity

## Test Connection

After setup, you can test with:
```bash
npm start
# Then in Claude Code, use: test_n8n_connection
```
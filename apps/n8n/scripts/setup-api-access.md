# n8n API Access Setup

To enable the n8n MCP server to work with your actual n8n instance and Supabase data, you need to set up API access.

## Step 1: Enable n8n API Access

1. **Open n8n UI**: Go to http://localhost:5678
2. **Complete Setup**: If this is your first time, complete the initial setup
3. **Go to Settings**: Click your profile → Settings
4. **API Section**: Navigate to "API" in the settings
5. **Create API Key**: Generate a new API key for MCP access

## Step 2: Add API Key to Environment

Once you have the API key, add it to `apps/n8n/.env`:

```bash
# n8n Configuration  
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your-local-n8n-api-key-here
```

The MCP configuration in `.cursor/mcp.json` uses these environment variables:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["n8n-mcp"],
      "env": {
        "N8N_API_URL": "${N8N_API_URL}",
        "N8N_API_KEY": "${N8N_API_KEY}"
      }
    }
  }
}
```

**Benefits:**
- ✅ **Secure**: API keys in .env (not committed to Git)
- ✅ **Team-friendly**: Each developer has their own API key
- ✅ **Simple**: One place to manage n8n configuration

## Step 3: Test Connection

After updating the configuration:

1. **Restart Cursor** to reload MCP configuration
2. **Test API Access**:
   ```bash
   curl -H "X-N8N-API-KEY: your-api-key" http://localhost:5678/api/v1/workflows
   ```

## Step 4: Verify MCP Integration

With the API key configured, the n8n MCP server will be able to:

- ✅ **Read existing workflows** from your n8n instance
- ✅ **Create new workflows** directly in n8n
- ✅ **Access workflow templates** and examples
- ✅ **Integrate with Supabase** database through n8n nodes
- ✅ **Export workflows** using our migration system

## Integration with Workflow Sync

Once API access is configured, the complete workflow becomes:

1. **AI Creates Workflow**: Using natural language description
2. **MCP Saves to n8n**: Directly creates workflow in your n8n instance
3. **Export as Migration**: Use `npm run n8n:create-migration "Workflow Name"`
4. **Team Sync**: Commit migration for team collaboration

This gives you the full power of AI-assisted workflow creation connected to your actual n8n and Supabase infrastructure.

## Troubleshooting

### API Key Issues
- Verify the key is correct in `.cursor/mcp.json`
- Check that n8n API is enabled in settings
- Restart Cursor after configuration changes

### Connection Issues  
- Ensure n8n is running on port 5678
- Check that Supabase is accessible on port 7012
- Verify no firewall blocking local connections

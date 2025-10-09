# How to Import the Requirements Writer Workflow into N8N

Since you have N8N running on localhost:5678 with an API key configured, here's how to get the Requirements Writer agent visible in your N8N instance.

## Quick Import Steps

### Option 1: Web Interface (Easiest)

1. **Open N8N**
   ```
   http://localhost:5678
   ```

2. **Import Workflow**
   - Click the menu icon (☰) in the top-left
   - Select "Import from file"
   - Choose this file: `/Users/nicholasweber/Sites/orchestrator-ai/apps/n8n/workflows/requirements-writer-validated.json`
   - Click "Import"

3. **Activate Workflow**
   - Once imported, you'll see the workflow
   - Click the "Inactive" toggle in the top-right to activate it
   - Note the webhook URL shown in the webhook node

4. **Test the Workflow**
   ```bash
   curl -X POST http://localhost:5678/webhook/requirements \
     -H "Content-Type: application/json" \
     -d '{"userMessage": "Create a user authentication system for our mobile app"}'
   ```

### Option 2: Using curl with API Key

```bash
# From the project root
cd /Users/nicholasweber/Sites/orchestrator-ai

# Import the workflow
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlNjY5ZTFmZS1mZWFhLTRkY2EtYmYyYi0yYTM4NjA1ZjUyMjEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwMDE2ODY4fQ.r9Pn-1St4ceJB82A7yDOTckT6yhFYxlQ8xm7GLvKJ58" \
  -d @apps/n8n/workflows/requirements-writer-validated.json
```

## What You'll See

Once imported, you'll see a workflow with 3 nodes:

1. **Requirements Webhook** (purple) - Receives POST requests
2. **Generate Requirements** (blue) - AI Transform node that generates the document
3. **Respond to Webhook** (green) - Returns the result as JSON

## Testing the Agent

After activation, the webhook will be available at:
```
http://localhost:5678/webhook/requirements
```

Test with:
```bash
curl -X POST http://localhost:5678/webhook/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Create a user authentication system for our mobile app",
    "mode": "build"
  }'
```

Expected response:
```json
{
  "success": true,
  "response": "# Requirements Document\n\n## Executive Summary\n...",
  "metadata": {
    "agentName": "Requirements Writer (N8N)",
    "processingTime": 1500,
    "documentType": "general",
    ...
  }
}
```

## Monitoring Executions

1. Go to http://localhost:5678
2. Click "Executions" in the left sidebar
3. You'll see all workflow runs with:
   - Success/failure status
   - Execution time
   - Input/output data
   - Error messages if any

## Troubleshooting

### Workflow Not Visible
- Refresh the N8N page
- Check if import was successful
- Look for the workflow in the workflows list

### AI Transform Not Working
- N8N Cloud plans have AI Transform enabled by default
- Self-hosted: You may need to configure AI credentials in Settings > AI

### Webhook Returns Error
- Check if workflow is activated (toggle should be green)
- Verify the webhook path is correct
- Check execution logs for details

## Next Steps

1. **Activate the Workflow** - Toggle to green
2. **Test with curl** - Run the test command above
3. **Check Executions** - View the results in N8N
4. **Customize** - Modify the AI Transform instructions as needed

The workflow is now ready to use as a Requirements Writer agent via webhook!


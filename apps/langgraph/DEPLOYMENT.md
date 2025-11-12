# LangGraph Deployment Guide

## Quick Start

The LangGraph server is automatically started when you run:

```bash
npm run dev:api
```

This will start:
- ✅ Supabase (port 7012)
- ✅ n8n (port 5678)
- ✅ **LangGraph (port 7200)** ← NEW!
- ✅ NestJS API (port 7100)

## Manual Control

### Start LangGraph Only
```bash
cd apps/langgraph
npm run start:dev
```

### Check if Running
```bash
curl http://localhost:7200/health
# Should return: {"status":"ok","timestamp":"2025-01-04T..."}
```

### Stop LangGraph
```bash
lsof -ti:7200 | xargs kill -9
```

## Testing the Workflows

### 1. Direct HTTP Test

Test marketing-swarm workflow:
```bash
curl -X POST http://localhost:7200/workflows/marketing-swarm \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "123e4567-e89b-12d3-a456-426614174000",
    "conversationId": "123e4567-e89b-12d3-a456-426614174001",
    "userId": "123e4567-e89b-12d3-a456-426614174002",
    "provider": "anthropic",
    "model": "claude-3-sonnet",
    "prompt": "Announce the launch of our new AI analytics platform",
    "statusWebhook": "http://localhost:7100/webhooks/status"
  }'
```

### 2. Via API Agents

The 3 workflows are available as API agents in the database:
- `marketing-swarm-langgraph`
- `requirements-writer-langgraph`
- `metrics-agent-langgraph`

Test via A2A protocol:
```bash
curl -X POST http://localhost:7100/a2a/agents/marketing/marketing-swarm-langgraph/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "method": "process",
    "prompt": "Announce the launch of our new AI analytics platform"
  }'
```

### 3. Via Orchestrator UI

1. Navigate to http://localhost:4100
2. Go to Agents section
3. Find:
   - Marketing Swarm (LangGraph)
   - Requirements Writer (LangGraph)
   - Metrics Agent (LangGraph)
4. Click "Test" and enter your prompt

## Logs

LangGraph logs are written to:
```bash
tail -f /tmp/langgraph.log
```

## Troubleshooting

### Port 7200 Already in Use
```bash
lsof -ti:7200 | xargs kill -9
npm run dev:api
```

### LangGraph Not Starting
Check dependencies:
```bash
cd apps/langgraph
npm install
npm run build
npm run start:dev
```

### LLM Service Connection Failed
Ensure the main API is running:
```bash
curl http://localhost:7100/health
```

### Webhook Not Working
Check the API webhooks controller:
```bash
curl -X POST http://localhost:7100/webhooks/status \
  -H "Content-Type: application/json" \
  -d '{"taskId":"test","status":"progress","timestamp":"2025-01-04T12:00:00Z"}'
```

## Environment Variables

LangGraph uses these environment variables (in `apps/langgraph/.env`):

```env
LANGGRAPH_PORT=7200
LANGGRAPH_HOST=0.0.0.0
LLM_SERVICE_URL=http://localhost:7100
LLM_ENDPOINT=/llm/generate
WEBHOOK_STATUS_URL=http://localhost:7100/webhooks/status
```

## Integration Flow

```
User Request
    ↓
Orchestrator UI (port 4100)
    ↓
NestJS API (port 7100) - Routes to API agent
    ↓
LangGraph Server (port 7200) - Executes workflow
    ↓ (calls)
LLM Service (port 7100) - /llm/generate
    ↓ (streams to)
Webhook Service (port 7100) - /webhooks/status
    ↓ (updates)
Task Status in Database
    ↓ (displays in)
Orchestrator UI
```

## Production Deployment

For production, run LangGraph as a separate service:

```bash
cd apps/langgraph
npm run build
npm run start:prod
```

Or use PM2:
```bash
pm2 start dist/main.js --name langgraph
```

## Updating Agent Configuration

If you need to update the API agent configurations:

```bash
# Edit the SQL file
nano apps/langgraph/sql/insert-api-agents.sql

# Re-run the SQL
export PGPASSWORD=postgres && \
psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/langgraph/sql/insert-api-agents.sql
```

The agents use ON CONFLICT DO UPDATE, so re-running is safe.

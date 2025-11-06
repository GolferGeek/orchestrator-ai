# LangGraph Workflow Engine

TypeScript-based LangGraph workflow execution engine for Orchestrator AI. Provides HTTP endpoints for complex multi-step AI workflows with real-time progress streaming.

## Overview

This NestJS application serves as a dedicated workflow execution engine, running independently from the main API. It exposes three workflow endpoints that can be called directly or wrapped as API agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    apps/langgraph/                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         LangGraph Workflow Endpoints               │   │
│  │  POST /workflows/marketing-swarm                   │   │
│  │  POST /workflows/requirements-writer               │   │
│  │  POST /workflows/metrics-agent                     │   │
│  └────────────────┬───────────────────────────────────┘   │
│                   │                                         │
│  ┌────────────────▼───────────────────────────────────┐   │
│  │      Workflow Execution Engine                     │   │
│  │  - Sequential LLM call orchestration               │   │
│  │  - Webhook progress streaming                      │   │
│  │  - Error handling & retries                        │   │
│  └────────┬──────────────────────┬────────────────────┘   │
│           │                      │                         │
│  ┌────────▼──────────┐  ┌────────▼──────────────────┐    │
│  │  LLM HTTP Client  │  │  Webhook Status Service   │    │
│  │  Service          │  │  - Send progress updates  │    │
│  └────────┬──────────┘  └───────────────────────────┘    │
└───────────┼─────────────────────────────────────────────┘
            │
            │ HTTP POST /llm/generate
            ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/api (Port 7100)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LLM Service: POST /llm/generate                     │  │
│  │  Webhook Service: POST /webhooks/status              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. Marketing Swarm (3 steps)
**Endpoint:** `POST /workflows/marketing-swarm`

Generates comprehensive marketing content for product announcements:
1. **Web Post** - Engaging blog post for all audiences
2. **SEO Content** - Meta tags, keywords, structured data
3. **Social Media** - Platform-specific posts (Twitter, LinkedIn, Facebook)

**Use Case:** Launch announcements, feature releases, company news

### 2. Requirements Writer (6 steps)
**Endpoint:** `POST /workflows/requirements-writer`

Transforms ideas into professional requirements documents:
1. **Analyze Request** - Understand intent, scope, and domain
2. **Determine Document Type** - Auto-select PRD, TRD, API, User Story, or Architecture doc
3. **Extract Features** - Identify key components and capabilities
4. **Assess Complexity** - Evaluate effort, team size, and risks
5. **Generate Document** - Create comprehensive requirements
6. **Finalize Response** - Package with metadata

**Use Case:** Feature planning, system design, API specifications

### 3. Metrics Agent (2 steps)
**Endpoint:** `POST /workflows/metrics-agent`

Analyzes business metrics and generates insights:
1. **Parse Query** - Identify metrics type and data sources
2. **Generate Report** - Create markdown report with SQL queries

**Use Case:** Revenue analysis, KPI tracking, operational metrics

## Installation

```bash
cd apps/langgraph
npm install
```

## Configuration

Create `.env` file:

```env
# LangGraph Application
LANGGRAPH_PORT=7200
LANGGRAPH_HOST=0.0.0.0

# LLM Service Integration
LLM_SERVICE_URL=http://localhost:7100
LLM_ENDPOINT=/llm/generate

# Webhook Configuration
WEBHOOK_STATUS_URL=http://localhost:7100/webhooks/status

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

## Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Health Check
```bash
curl http://localhost:7200/health
```

## API Request Format

All workflows accept the same request format:

```typescript
{
  "taskId": "uuid",           // Required: Unique task identifier
  "conversationId": "uuid",   // Required: Conversation context
  "userId": "uuid",           // Required: User identifier
  "provider": "anthropic",    // Required: LLM provider (anthropic, openai, ollama, google)
  "model": "claude-3-opus",   // Required: Model name
  "prompt": "string",         // Required: User request/announcement
  "statusWebhook": "url",     // Optional: Webhook URL for progress updates
  "metadata": {}              // Optional: Additional context (requirements-writer only)
}
```

## Response Format

All workflows return:

```typescript
{
  "success": true,
  "taskId": "uuid",
  "conversationId": "uuid",
  "data": {
    // Workflow-specific results
  },
  "metadata": {
    "executionTime": 45000,      // Milliseconds
    "stepsCompleted": 3,
    "provider": "anthropic",
    "model": "claude-3-opus"
  }
}
```

## Webhook Streaming

When `statusWebhook` is provided, the workflow sends progress updates:

### Started
```json
{
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "status": "started",
  "timestamp": "2025-01-04T12:00:00Z",
  "message": "Workflow execution started",
  "totalSteps": 3
}
```

### Progress
```json
{
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "status": "progress",
  "timestamp": "2025-01-04T12:00:15Z",
  "step": "Write Blog Post",
  "sequence": 1,
  "totalSteps": 3,
  "message": "Executing step 1/3: Write Blog Post"
}
```

### Completed
```json
{
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "status": "completed",
  "timestamp": "2025-01-04T12:01:30Z",
  "message": "Workflow execution completed",
  "data": {
    // Final results
  }
}
```

### Failed
```json
{
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "status": "failed",
  "timestamp": "2025-01-04T12:00:45Z",
  "message": "Workflow execution failed",
  "error": "Error message"
}
```

## API Agent Integration

Three API agents have been created in the database to wrap these workflows:

1. **marketing-swarm-langgraph** - Marketing content generation
2. **requirements-writer-langgraph** - Requirements documentation
3. **metrics-agent-langgraph** - Business metrics analysis

These can be invoked through the Orchestrator AI A2A protocol:

```bash
curl -X POST http://localhost:7100/a2a/agents/marketing/marketing-swarm-langgraph/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "method": "process",
    "prompt": "Announce the launch of our new AI-powered analytics platform"
  }'
```

## Example: Marketing Swarm

```bash
curl -X POST http://localhost:7200/workflows/marketing-swarm \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "123e4567-e89b-12d3-a456-426614174000",
    "conversationId": "123e4567-e89b-12d3-a456-426614174001",
    "userId": "123e4567-e89b-12d3-a456-426614174002",
    "provider": "anthropic",
    "model": "claude-3-sonnet",
    "prompt": "Announce the launch of our new AI-powered analytics platform",
    "statusWebhook": "http://localhost:7100/webhooks/status"
  }'
```

**Response:**
```json
{
  "success": true,
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "conversationId": "123e4567-e89b-12d3-a456-426614174001",
  "data": {
    "webPost": "# Introducing Our Revolutionary AI-Powered Analytics Platform\n\n...",
    "seoContent": "Meta Title: AI-Powered Analytics Platform Launch...",
    "socialMedia": "🚀 Twitter: Excited to announce..."
  },
  "metadata": {
    "executionTime": 45231,
    "stepsCompleted": 3,
    "provider": "anthropic",
    "model": "claude-3-sonnet"
  }
}
```

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Coverage
```bash
npm run test:cov
```

## Project Structure

```
apps/langgraph/
├── src/
│   ├── main.ts                          # Application entry point
│   ├── app.module.ts                    # Root module
│   ├── common/
│   │   └── dto/                         # Shared DTOs
│   ├── services/
│   │   ├── llm-http-client.service.ts   # LLM integration
│   │   └── webhook-status.service.ts    # Progress streaming
│   ├── workflows/
│   │   ├── workflows.controller.ts      # HTTP endpoints
│   │   ├── workflows.service.ts         # Workflow orchestration
│   │   ├── workflows.module.ts
│   │   ├── graphs/                      # Workflow implementations
│   │   │   ├── marketing-swarm.graph.ts
│   │   │   ├── requirements-writer.graph.ts
│   │   │   └── metrics-agent.graph.ts
│   │   └── nodes/
│   │       └── llm-node.ts              # Reusable LLM executor
│   └── health/
│       └── health.controller.ts         # Health checks
├── sql/
│   └── insert-api-agents.sql            # Database setup
├── test/                                # Tests
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env
```

## Dependencies

- **@nestjs/core** - NestJS framework
- **@nestjs/axios** - HTTP client
- **@langchain/langgraph** - LangGraph TypeScript SDK
- **class-validator** - Input validation
- **rxjs** - Reactive programming

## Troubleshooting

### Port Already in Use
```bash
lsof -ti:7200 | xargs kill -9
```

### LLM Service Connection Failed
- Ensure `apps/api` is running on port 7100
- Check `LLM_SERVICE_URL` in `.env`

### Webhook Delivery Failed
- Webhook failures are logged but don't break workflow execution
- Check webhook endpoint is accessible

## Development

### Adding a New Workflow

1. Create workflow graph in `src/workflows/graphs/my-workflow.graph.ts`
2. Add method to `workflows.service.ts`
3. Add endpoint to `workflows.controller.ts`
4. Create API agent SQL in `sql/`
5. Add tests

### Code Style
```bash
npm run lint
npm run format
```

## Performance

- **Marketing Swarm**: ~30-60 seconds (3 LLM calls)
- **Requirements Writer**: ~60-120 seconds (6 LLM calls)
- **Metrics Agent**: ~15-30 seconds (2 LLM calls)

Times vary based on LLM provider, model, and content complexity.

## License

See root LICENSE file.

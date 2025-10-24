# Phase 3: API Agents (n8n Integration)

## Overview
Implement API agent type that delegates execution to external services via n8n workflows. Convert complex file-based agents (metrics, marketing swarm, requirements writer) into API agents backed by n8n.

## Goals
- Implement API agent execution flow (webhook-based)
- Build 3 reference n8n workflows
- Handle async execution and callbacks
- Validate API agent architecture
- Offload complex logic from monolith to n8n

## Prerequisites
- ✅ Phase 1 complete (context agents)
- ✅ Phase 2 complete (conversation-only agents)
- ⏳ n8n instance running locally via Docker (see Setup section below)
- ⏳ n8n workflow sync system (from [n8n PRD](/docs/feature/matt/n8n/prd-bidirectional-workflow-sync.md))

## n8n Local Setup

### Installing n8n with Docker

**Prerequisites:**
- Docker 20.10+ (includes Docker Compose as plugin)
- Node.js 18.x, 20.x, or 22.x
- 4GB RAM minimum
- Port 5678 available

**Quick Start:**
```bash
# Create project directory
mkdir -p orchestrator-ai/n8n-local
cd orchestrator-ai/n8n-local

# Create .env file
cat > .env << 'EOF'
# n8n Configuration
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_HOST=localhost
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=change_this_password

# Database (PostgreSQL recommended for production)
DB_TYPE=postgresdb
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=n8n_password

# Webhook URL for external callbacks
WEBHOOK_URL=http://localhost:5678/
N8N_PAYLOAD_SIZE_MAX=16

# Timezone
GENERIC_TIMEZONE=America/New_York
EOF

# Create Docker Compose file
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: n8n_password
      POSTGRES_DB: n8n
    volumes:
      - n8n_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U n8n']
      interval: 5s
      timeout: 5s
      retries: 10

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - '5678:5678'
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=n8n_password
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=change_this_password
      - WEBHOOK_URL=http://localhost:5678/
    volumes:
      - n8n_data:/home/node/.n8n
      - ./local-files:/files
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  n8n_data:
  n8n_postgres_data:
EOF

# Create local files directory for sharing
mkdir -p local-files

# Start n8n
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f n8n
```

**Access n8n:**
- URL: http://localhost:5678
- First time: Create owner account
- Credentials: Use values from .env (admin/change_this_password)

**Stopping/Restarting:**
```bash
# Stop
docker-compose stop

# Start
docker-compose start

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Shutdown and remove
docker-compose down
```

### n8n Workflow Sync Setup

Follow the [n8n Bidirectional Workflow Sync PRD](/docs/feature/matt/n8n/prd-bidirectional-workflow-sync.md) to set up workflow versioning in Git.

**Quick Setup:**
```bash
# Install scripts (from n8n PRD)
npm run n8n:setup

# Export a workflow to migration
npm run n8n:create-migration "Workflow Name"

# Apply migrations
npm run n8n:migrate-up
```

### Using n8n MCP to Scaffold Workflows 🚀

The **n8n MCP (Model Context Protocol)** service makes it incredibly easy to scaffold complex n8n workflows. Instead of manually building workflows in the n8n UI, you can use AI to generate workflow definitions that you can import directly.

**How It Works:**
1. Use Claude Code (or any MCP-enabled AI) to describe the workflow you want
2. The n8n MCP generates the complete workflow JSON
3. Import the workflow into your local n8n instance
4. Refine and test the workflow
5. Export to migration for version control

**Example: Scaffolding the Marketing Swarm Workflow**

```typescript
// In Claude Code or AI assistant with n8n MCP access
User: "Create an n8n workflow for the Marketing Swarm agent that:
- Receives a webhook with task data
- Runs 4 parallel LLM analyses (competitor, trends, content, customer)
- Merges results and synthesizes a final report
- Sends progress updates at each step
- Calls back to the orchestrator API with the final result"

// The n8n MCP generates complete workflow JSON:
{
  "name": "Marketing Swarm Agent",
  "nodes": [
    {
      "id": "webhook-trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "path": "marketing-swarm",
        "httpMethod": "POST",
        "responseMode": "responseNode",
        "authentication": "headerAuth"
      }
    },
    {
      "id": "parse-request",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [450, 300],
      "parameters": {
        "jsCode": `
// Extract task context
const taskId = $input.item.json.task_id;
const userMessage = $input.item.json.user_message;
const callbackUrl = $input.item.json.callback_url;

return [
  {
    json: {
      taskId,
      userMessage,
      callbackUrl,
      timestamp: new Date().toISOString()
    }
  }
];`
      }
    },
    {
      "id": "competitor-analysis",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [650, 200],
      "parameters": {
        "model": "claude-3-5-sonnet-20241022",
        "prompt": "Analyze competitor landscape: {{$json.userMessage}}"
      }
    },
    {
      "id": "market-trends",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [650, 300],
      "parameters": {
        "model": "claude-3-5-sonnet-20241022",
        "prompt": "Identify market trends: {{$json.userMessage}}"
      }
    },
    // ... more nodes for content strategy, customer insights
    {
      "id": "merge-results",
      "type": "n8n-nodes-base.merge",
      "typeVersion": 2,
      "position": [850, 300],
      "parameters": {
        "mode": "combine",
        "mergeByFields": {
          "values": [
            { "field1": "taskId", "field2": "taskId" }
          ]
        }
      }
    },
    {
      "id": "synthesize-report",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [1050, 300],
      "parameters": {
        "model": "claude-3-5-sonnet-20241022",
        "prompt": `Synthesize marketing analysis from:
- Competitors: {{$json.competitors}}
- Trends: {{$json.trends}}
- Content: {{$json.content}}
- Customers: {{$json.customers}}`
      }
    },
    {
      "id": "send-callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [1250, 300],
      "parameters": {
        "method": "POST",
        "url": "={{$json.callbackUrl}}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "task_id", "value": "={{$json.taskId}}" },
            { "name": "status", "value": "completed" },
            { "name": "result", "value": "={{$json.report}}" }
          ]
        }
      }
    }
  ],
  "connections": {
    "webhook-trigger": { "main": [[{"node": "parse-request"}]] },
    "parse-request": { "main": [[
      {"node": "competitor-analysis"},
      {"node": "market-trends"},
      {"node": "content-strategy"},
      {"node": "customer-insights"}
    ]]},
    "competitor-analysis": { "main": [[{"node": "merge-results"}]] },
    // ... more connections
  }
}
```

**Benefits of Using n8n MCP:**
1. ⚡ **Speed:** Generate complex workflows in seconds instead of hours
2. 🎯 **Accuracy:** AI understands n8n node types and parameters
3. 🔄 **Iteration:** Quickly refine workflows with natural language prompts
4. 📦 **Reusability:** Generate similar workflows for different agents
5. 🧪 **Testing:** Scaffold test workflows for experimentation

**Workflow:**
```bash
# 1. Generate workflow with AI + n8n MCP
"Create workflow for Requirements Writer agent..."

# 2. Save generated JSON to file
cat > workflows/requirements-writer.json << 'EOF'
{generated workflow JSON}
EOF

# 3. Import to n8n
# Method A: Via n8n UI (Workflows → Import from File)
# Method B: Via n8n API
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -u "admin:change_this_password" \
  -d @workflows/requirements-writer.json

# 4. Test the workflow in n8n UI

# 5. Export to migration
npm run n8n:create-migration "Requirements Writer"

# 6. Commit to Git
git add apps/api/supabase/migrations/
git commit -m "feat: add requirements writer n8n workflow"
```

**Example Prompts for n8n MCP:**
- "Create an n8n workflow that processes customer feedback and generates sentiment analysis"
- "Build a workflow that scrapes competitor websites and compares pricing"
- "Generate a workflow for automated email campaigns with A/B testing"
- "Create a workflow that monitors social media mentions and triggers alerts"

This approach dramatically reduces the time to build complex n8n agents from days to hours!

## Scope

### In Scope
1. **API Agent Type**
   - `agent_type: 'api'`
   - Configuration includes webhook URL
   - Async execution via n8n
   - Callback handling for results

2. **Three API Agents**
   - **Metrics Agent:** Fetch and analyze system metrics
   - **Marketing Swarm Agent:** Multi-agent marketing analysis (complex)
   - **Requirements Writer Agent:** Technical requirements generation

3. **n8n Workflows**
   - One workflow per agent
   - Webhook trigger
   - Business logic execution
   - Callback to orchestrator-ai API

4. **Backend Implementation**
   - API agent runner service
   - Webhook call to n8n
   - Callback endpoint for results
   - Task status tracking (pending → running → completed)

5. **Frontend Support**
   - API agents appear in agent list
   - Execute like other agents
   - Show "processing" state during async execution
   - Handle longer execution times gracefully

### Out of Scope
- File-based agent removal (Phase 5)
- Image deliverables (Phase 4)
- Orchestration (Phase 6)
- Function agents (already implemented)

## Success Criteria

### User Can:
1. ✅ Select metrics agent from agent list
2. ✅ Request: "Show me last 24h metrics"
3. ✅ See "processing" indicator
4. ✅ Receive metrics data when n8n completes
5. ✅ Same flow works for marketing swarm and requirements writer
6. ✅ Error handling if n8n workflow fails

### Technical Requirements:
1. ✅ API agents execute via webhook to n8n
2. ✅ Task status updates from pending → running → completed
3. ✅ Callback endpoint receives results
4. ✅ Results stored in task record
5. ✅ Deliverables created if applicable
6. ✅ Timeout handling (max 5 minutes)
7. ✅ n8n workflows versioned in git

## Implementation Tasks

### Backend - API Agent Execution
1. **Create ApiAgentRunnerService**
   - `execute(agent, request)` → calls webhook
   - Build webhook payload with task context
   - Return immediately with task ID (async)
   - Handle webhook authentication

2. **Create API callback endpoint**
   - `POST /agent-to-agent/api-callback/:taskId`
   - Validate callback signature
   - Update task status to completed
   - Store result in task record
   - Create deliverable if needed
   - **Notify via WebSocket** (real-time update to frontend)

3. **Create API progress endpoint** (NEW)
   - `POST /agent-to-agent/api-progress/:taskId`
   - Receive incremental progress updates from n8n
   - Update task metadata with progress percentage
   - **Broadcast progress via WebSocket** (real-time to frontend)
   - Support partial results for streaming UX

3. **Update AgentModeRouterService**
   - Check if agent_type === 'api'
   - Route to ApiAgentRunnerService
   - Handle async execution flow

4. **Task status tracking**
   - Create task with status: pending
   - Update to running when webhook called
   - Update to completed/failed on callback
   - Support timeout after 5 minutes

### n8n Workflows
5. **Metrics Agent Workflow**
   - Webhook trigger: `/webhook/metrics-agent`
   - Extract task ID and user message
   - Query metrics from database/APIs
   - Format response
   - Callback to: `POST /agent-to-agent/api-callback/{taskId}`

6. **Marketing Swarm Agent Workflow**
   - Webhook trigger: `/webhook/marketing-swarm`
   - Complex multi-step analysis
   - Call multiple LLMs (or sub-workflows)
   - Aggregate results
   - Callback with final output

7. **Requirements Writer Workflow**
   - Webhook trigger: `/webhook/requirements-writer`
   - Parse user input
   - Generate technical requirements
   - Format as structured document
   - Callback with requirements

8. **Workflow sync to git**
   - Export workflows as JSON
   - Store in `apps/api/n8n/workflows/`
   - Use migration scripts from n8n PRD
   - Version control all workflows

### Agent Configuration
9. **Create Metrics Agent**
```typescript
{
  slug: 'metrics_agent',
  name: 'Metrics Agent',
  agent_type: 'api',
  config: {
    api: {
      webhook_url: 'https://n8n.example.com/webhook/metrics-agent',
      auth_type: 'bearer',
      auth_token: '${N8N_WEBHOOK_TOKEN}',
      timeout_ms: 300000 // 5 minutes
    },
    systemPrompt: 'You analyze system metrics...'
  },
  execution_profile: 'autonomous_build',
  execution_capabilities: { can_build: true }
}
```

10. **Create Marketing Swarm Agent**
11. **Create Requirements Writer Agent**

### Frontend
12. **Update agent2AgentChatStore**
   - Handle async task execution
   - ~~Poll task status if needed~~ (NOT NEEDED - use WebSocket!)
   - Show "processing" state
   - Handle timeout errors
   - **Subscribe to WebSocket task updates**
   - **Display real-time progress messages**

13. **Update ConversationView.vue**
   - Show loading indicator during API execution
   - Display "Agent is processing..." message
   - **Show progress bar with percentage**
   - **Display incremental status messages**
   - Timeout warning after 3 minutes

## WebSocket Real-Time Updates 🔴

The orchestrator-AI platform already has WebSocket infrastructure in place. For n8n API agents, we leverage this to provide **real-time progress updates** from n8n workflows to the frontend without polling.

### Complete Real-Time Flow

```
n8n Workflow (Marketing Swarm)
  ↓
  [Step 1: Competitor Analysis Complete]
  ↓
HTTP POST /api/agent-to-agent/api-progress/:taskId
{
  progress: 25,
  message: "Competitor analysis complete"
}
  ↓
ApiProgressController (Backend)
  ↓
Update task.metadata.progress = 25
  ↓
WebSocketGateway.broadcast('task:progress', {
  taskId: 'task-123',
  conversationId: 'conv-456',
  progress: 25,
  message: 'Competitor analysis complete',
  timestamp: '2025-10-04T...'
})
  ↓
WebSocket Connection → Frontend
  ↓
agent2AgentChatStore.handleTaskProgress()
  ↓
UI Updates (Progress Bar + Message)
```

### Backend Implementation

#### API Progress Controller

```typescript
// apps/api/src/agent-to-agent/controllers/api-progress.controller.ts
import { Controller, Post, Param, Body } from '@nestjs/common';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AgentTasksRepository } from '../repositories/agent-tasks.repository';

interface ProgressUpdate {
  task_id: string;
  progress: number;        // 0-100
  message: string;
  partial_result?: any;
  metadata?: Record<string, any>;
}

@Controller('agent-to-agent/api-progress')
export class ApiProgressController {
  constructor(
    private readonly tasksRepo: AgentTasksRepository,
    private readonly websocketGateway: WebSocketGateway,
  ) {}

  @Post(':taskId')
  async handleProgressUpdate(
    @Param('taskId') taskId: string,
    @Body() progressData: ProgressUpdate,
  ) {
    // 1. Validate task exists
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // 2. Update task metadata with progress
    await this.tasksRepo.update(taskId, {
      metadata: {
        ...task.metadata,
        progress: progressData.progress,
        last_progress_message: progressData.message,
        last_progress_at: new Date().toISOString(),
        partial_results: progressData.partial_result
          ? [...(task.metadata.partial_results || []), progressData.partial_result]
          : task.metadata.partial_results,
      },
    });

    // 3. Broadcast progress via WebSocket
    this.websocketGateway.broadcastToConversation(
      task.conversation_id,
      'task:progress',
      {
        taskId: task.id,
        conversationId: task.conversation_id,
        agentSlug: task.agent_slug,
        progress: progressData.progress,
        message: progressData.message,
        partialResult: progressData.partial_result,
        timestamp: new Date().toISOString(),
      },
    );

    return {
      success: true,
      message: 'Progress update received',
    };
  }
}
```

#### API Callback Controller (Enhanced)

```typescript
// apps/api/src/agent-to-agent/controllers/api-callback.controller.ts
@Controller('agent-to-agent/api-callback')
export class ApiCallbackController {
  constructor(
    private readonly tasksRepo: AgentTasksRepository,
    private readonly deliverablesService: Agent2AgentDeliverablesService,
    private readonly websocketGateway: WebSocketGateway,
  ) {}

  @Post(':taskId')
  async handleCallback(
    @Param('taskId') taskId: string,
    @Body() callbackData: CallbackData,
  ) {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // Update task status
    await this.tasksRepo.update(taskId, {
      status: callbackData.status === 'completed' ? 'completed' : 'failed',
      result: callbackData.result,
      error_message: callbackData.error,
      completed_at: new Date(),
    });

    // Create deliverable if applicable
    if (callbackData.status === 'completed' && callbackData.result?.content) {
      await this.deliverablesService.createFromTaskResult(task, callbackData.result);
    }

    // Broadcast completion via WebSocket
    this.websocketGateway.broadcastToConversation(
      task.conversation_id,
      'task:completed',
      {
        taskId: task.id,
        conversationId: task.conversation_id,
        status: callbackData.status,
        result: callbackData.result,
        error: callbackData.error,
        timestamp: new Date().toISOString(),
      },
    );

    return { success: true };
  }
}
```

### Frontend Implementation

#### WebSocket Subscription (agent2AgentChatStore)

```typescript
// apps/web/src/stores/agent2AgentChatStore.ts
import { defineStore } from 'pinia';
import { useWebSocket } from '@/composables/useWebSocket';

export const useAgent2AgentChatStore = defineStore('agent2AgentChat', {
  state: () => ({
    activeTaskProgress: {} as Record<string, TaskProgress>,
  }),

  actions: {
    initializeWebSocket(conversationId: string) {
      const { subscribe } = useWebSocket();

      // Subscribe to task progress updates
      subscribe(`conversation:${conversationId}`, (event) => {
        if (event.type === 'task:progress') {
          this.handleTaskProgress(event.data);
        } else if (event.type === 'task:completed') {
          this.handleTaskCompleted(event.data);
        }
      });
    },

    handleTaskProgress(data: TaskProgressData) {
      // Update progress state
      this.activeTaskProgress[data.taskId] = {
        progress: data.progress,
        message: data.message,
        partialResult: data.partialResult,
        updatedAt: data.timestamp,
      };

      // Add progress message to conversation
      this.addProgressMessage({
        taskId: data.taskId,
        type: 'progress',
        content: data.message,
        progress: data.progress,
      });
    },

    handleTaskCompleted(data: TaskCompletedData) {
      // Remove from active progress
      delete this.activeTaskProgress[data.taskId];

      // Add final message to conversation
      if (data.status === 'completed') {
        this.addAgentMessage({
          taskId: data.taskId,
          content: data.result.content,
          metadata: data.result.metadata,
        });
      } else {
        this.addErrorMessage({
          taskId: data.taskId,
          error: data.error,
        });
      }
    },
  },
});
```

#### Progress UI Component

```vue
<!-- apps/web/src/components/TaskProgressIndicator.vue -->
<template>
  <div v-if="progress" class="task-progress">
    <div class="progress-header">
      <span class="agent-name">{{ agentName }}</span>
      <span class="progress-percentage">{{ progress.progress }}%</span>
    </div>

    <div class="progress-bar-container">
      <div
        class="progress-bar"
        :style="{ width: `${progress.progress}%` }"
      />
    </div>

    <div class="progress-message">
      <span class="icon">⏳</span>
      {{ progress.message }}
    </div>

    <!-- Optional: Show partial results -->
    <div v-if="progress.partialResult" class="partial-result">
      <details>
        <summary>Partial Results Available</summary>
        <pre>{{ JSON.stringify(progress.partialResult, null, 2) }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAgent2AgentChatStore } from '@/stores/agent2AgentChatStore';

const props = defineProps<{
  taskId: string;
  agentName: string;
}>();

const store = useAgent2AgentChatStore();

const progress = computed(() =>
  store.activeTaskProgress[props.taskId]
);
</script>

<style scoped>
.task-progress {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 0.5rem 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.progress-bar-container {
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s ease;
}

.progress-message {
  font-size: 0.875rem;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.partial-result {
  margin-top: 0.5rem;
  font-size: 0.75rem;
}
</style>
```

### n8n Workflow Integration

#### Marketing Swarm with Progress Updates

```javascript
// In n8n workflow nodes

// After Competitor Analysis completes
// HTTP Request Node: Send Progress Update
{
  "method": "POST",
  "url": "http://localhost:7100/api/agent-to-agent/api-progress/{{$json.taskId}}",
  "authentication": "headerAuth",
  "body": {
    "task_id": "{{$json.taskId}}",
    "progress": 25,
    "message": "Competitor analysis complete. Found 5 key competitors.",
    "partial_result": {
      "competitors": ["{{$json.competitor1}}", "{{$json.competitor2}}", ...]
    }
  }
}

// After Market Trends completes
{
  "progress": 50,
  "message": "Market trends identified. 3 major opportunities detected."
}

// After Content Strategy completes
{
  "progress": 75,
  "message": "Content strategy recommendations generated."
}

// After Synthesis completes
{
  "progress": 95,
  "message": "Finalizing comprehensive marketing report..."
}

// Final callback (100%)
// HTTP Request Node: Send Completion Callback
{
  "method": "POST",
  "url": "http://localhost:7100/api/agent-to-agent/api-callback/{{$json.taskId}}",
  "body": {
    "task_id": "{{$json.taskId}}",
    "status": "completed",
    "result": {
      "content": "{{$json.finalReport}}",
      "metadata": {
        "agents_used": 4,
        "execution_time_ms": "{{$json.executionTime}}"
      }
    }
  }
}
```

### WebSocket Message Types

```typescript
// WebSocket events for task updates
interface WebSocketTaskEvents {
  // Progress update (incremental)
  'task:progress': {
    taskId: string;
    conversationId: string;
    agentSlug: string;
    progress: number;         // 0-100
    message: string;
    partialResult?: any;
    timestamp: string;
  };

  // Task completed (final)
  'task:completed': {
    taskId: string;
    conversationId: string;
    status: 'completed' | 'failed';
    result?: {
      content: string;
      metadata?: Record<string, any>;
    };
    error?: string;
    timestamp: string;
  };

  // Task started (optional)
  'task:started': {
    taskId: string;
    conversationId: string;
    agentSlug: string;
    estimatedDuration?: number;
    timestamp: string;
  };
}
```

### Benefits of WebSocket Approach

1. **No Polling Needed** ✅
   - Frontend doesn't poll for task status
   - Instant updates when n8n sends progress
   - Reduced server load

2. **Real-Time UX** ✅
   - Users see progress as it happens
   - "Competitor analysis complete..." appears immediately
   - Progress bar updates in real-time

3. **Partial Results** ✅
   - Show intermediate findings while workflow continues
   - Users can see value before completion
   - Example: "Found 5 competitors" while trends analysis runs

4. **Efficient** ✅
   - Single WebSocket connection per user
   - Multiple tasks can update simultaneously
   - Automatic reconnection on disconnect

5. **Scalable** ✅
   - WebSocket gateway handles broadcast to all connected clients
   - Works across multiple browser tabs
   - No database polling overhead

### Testing WebSocket Updates

```bash
# 1. Connect to WebSocket (frontend)
const ws = new WebSocket('ws://localhost:7100');
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'conversation:conv-123'
}));

# 2. Trigger n8n workflow (sends progress updates)
# n8n sends HTTP POST to /api/agent-to-agent/api-progress/:taskId

# 3. Frontend receives WebSocket message
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'task:progress') {
    console.log('Progress:', data.progress, '%', data.message);
    // Update UI with progress bar
  }
};
```

## Data Model

### API Agent Configuration
```typescript
{
  id: 'uuid',
  slug: 'metrics_agent',
  name: 'Metrics Agent',
  agent_type: 'api',
  config: {
    api: {
      webhook_url: string,
      auth_type: 'bearer' | 'none',
      auth_token?: string,
      timeout_ms: number,
      method: 'POST',
      headers?: Record<string, string>
    },
    systemPrompt?: string,
    // ... other config
  },
  execution_profile: 'autonomous_build',
  execution_capabilities: {
    can_plan: false,
    can_build: true
  },
  source: 'database',
  status: 'active'
}
```

### Webhook Payload (to n8n)
```typescript
{
  task_id: 'task-123',
  agent_slug: 'metrics_agent',
  conversation_id: 'conv-456',
  user_id: 'user-789',
  mode: 'build',
  user_message: 'Show me last 24h metrics',
  context?: {
    // Optional conversation context
  },
  callback_url: 'https://api.orchestrator.ai/agent-to-agent/api-callback/task-123'
}
```

### Callback Payload (from n8n)
```typescript
{
  task_id: 'task-123',
  status: 'completed' | 'failed',
  result?: {
    content: string,
    metadata?: Record<string, any>
  },
  error?: string
}
```

### Task Lifecycle
```
Create task (status: pending)
  ↓
Call webhook (status: running)
  ↓
Wait for callback...
  ↓
Receive callback (status: completed)
  ↓
Store result + create deliverable
  ↓
Notify user via WebSocket
```

## n8n Workflow Structure

### Example: Metrics Agent Workflow
```
[Webhook Trigger]
  ↓
[Extract Payload]
  ↓
[Query Metrics Database]
  ↓
[Format Response]
  ↓
[HTTP Request to Callback URL]
```

### Example: Marketing Swarm Workflow (Complex)
```
[Webhook Trigger]
  ↓
[Parse User Request]
  ↓
[Branch: Run Multiple Analyses]
  ├─ [Competitor Analysis] → [LLM Call]
  ├─ [Market Trends] → [LLM Call]
  └─ [Content Strategy] → [LLM Call]
  ↓
[Merge Results]
  ↓
[Aggregate Analysis] → [LLM Call]
  ↓
[Format Final Report]
  ↓
[HTTP Request to Callback URL]
```

## Detailed Agent Specifications

### 1. Marketing Swarm Agent

**Purpose:** Multi-agent marketing analysis using swarm intelligence to analyze markets, competitors, and content strategies simultaneously.

**Use Cases:**
- Competitor landscape analysis
- Market trend identification
- Content strategy recommendations
- Campaign performance analysis
- Multi-channel marketing optimization

**How It Works:**
The Marketing Swarm uses multiple specialized "sub-agents" (n8n sub-workflows or parallel LLM calls) that each focus on a specific aspect of marketing analysis. Results are aggregated into a comprehensive marketing report.

**n8n Workflow Architecture:**
```
1. Webhook Trigger (receives task from orchestrator-ai)
   ↓
2. Parse Request & Extract Context
   - User query: "Analyze our competitor landscape"
   - Product/brand context
   - Target audience
   ↓
3. Parallel Analysis Streams (Agent Swarm)
   ├─ Agent A: Competitor Analysis
   │  - Identify top competitors
   │  - Analyze their positioning
   │  - Extract key differentiators
   │  - LLM: Claude/GPT-4 for analysis
   │
   ├─ Agent B: Market Trends
   │  - Current industry trends
   │  - Emerging opportunities
   │  - Threat assessment
   │  - LLM: Claude/GPT-4 for trend analysis
   │
   ├─ Agent C: Content Strategy
   │  - Content gaps analysis
   │  - Topic recommendations
   │  - Channel optimization
   │  - LLM: Claude for content insights
   │
   └─ Agent D: Customer Insights (optional)
      - Pain points analysis
      - Persona refinement
      - Messaging recommendations
      - LLM: GPT-4 for customer psychology
   ↓
4. Merge & Aggregate Results
   - Collect all agent outputs
   - Identify cross-agent insights
   - Detect conflicts or consensus
   ↓
5. Synthesize Final Report (Coordinator Agent)
   - LLM call to synthesize findings
   - Create executive summary
   - Generate actionable recommendations
   - Format as structured markdown
   ↓
6. Progress Updates (Real-Time - NEW)
   - Send intermediate progress to callback URL
   - "Competitor analysis complete..."
   - "Market trends identified..."
   - "Synthesizing final report..."
   ↓
7. Final Callback to Orchestrator-AI
   - Send completed report
   - Include metadata (agents used, confidence scores)
```

**Real-Time Progress Updates:**
n8n supports streaming responses via the "Respond to Webhook" node with streaming enabled. For the Marketing Swarm, we'll use progressive updates:

```typescript
// Progress Update 1 (after Agent A completes)
POST /agent-to-agent/api-progress/:taskId
{
  task_id: 'task-123',
  status: 'running',
  progress: 25,
  message: 'Competitor analysis complete. Found 5 key competitors.',
  partial_result: {
    competitors: ['CompetitorA', 'CompetitorB', ...]
  }
}

// Progress Update 2 (after Agent B completes)
POST /agent-to-agent/api-progress/:taskId
{
  task_id: 'task-123',
  status: 'running',
  progress: 50,
  message: 'Market trends identified. 3 major opportunities detected.',
  partial_result: {
    trends: ['AI-driven personalization', 'Sustainability focus', ...]
  }
}

// Final Callback
POST /agent-to-agent/api-callback/:taskId
{
  task_id: 'task-123',
  status: 'completed',
  result: {
    content: '# Marketing Analysis Report\n\n...',
    metadata: {
      agents_used: 4,
      execution_time_ms: 45000,
      confidence_scores: {
        competitor_analysis: 0.92,
        market_trends: 0.88,
        content_strategy: 0.85
      }
    }
  }
}
```

**Agent Configuration:**
```typescript
{
  slug: 'marketing_swarm',
  name: 'Marketing Swarm Agent',
  description: 'Multi-agent marketing analysis using swarm intelligence',
  agent_type: 'api',
  config: {
    api: {
      webhook_url: 'http://localhost:5678/webhook/marketing-swarm',
      auth_type: 'bearer',
      auth_token: '${N8N_WEBHOOK_TOKEN}',
      timeout_ms: 180000, // 3 minutes for complex analysis
      supports_progress_updates: true,
      progress_callback_url: 'http://localhost:7100/api/agent-to-agent/api-progress/:taskId'
    },
    systemPrompt: `You are a Marketing Swarm Coordinator.

You orchestrate multiple specialized marketing analysts:
- Competitor Analysis Specialist
- Market Trends Analyst
- Content Strategy Expert
- Customer Insights Researcher

Your job is to:
1. Distribute analysis tasks to specialists
2. Collect and synthesize their findings
3. Generate comprehensive marketing recommendations
4. Provide actionable insights with confidence scores`
  },
  execution_profile: 'autonomous_build',
  execution_capabilities: {
    can_plan: false,
    can_build: true,
    can_orchestrate: false
  },
  source: 'database',
  status: 'active'
}
```

### 2. Requirements Writer Agent

**Purpose:** Automated technical requirements generation from natural language descriptions.

**Use Cases:**
- User story → technical specifications
- Feature request → requirements document
- Product brief → software requirements specification (SRS)
- API design → technical requirements
- Database schema → data requirements

**How It Works:**
The Requirements Writer uses AI to convert conversational feature descriptions into structured, comprehensive technical requirements following industry best practices (IEEE 830, ISO/IEC/IEEE 29148).

**n8n Workflow Architecture:**
```
1. Webhook Trigger
   ↓
2. Parse User Input
   - Feature description
   - Project context
   - Existing requirements (if any)
   ↓
3. Extract Requirements Components
   - Functional requirements
   - Non-functional requirements
   - Constraints
   - Acceptance criteria
   ↓
4. AI Requirements Generation (LLM Call)
   - Prompt: "Generate technical requirements for: {feature}"
   - Include: SRS structure, acceptance criteria, edge cases
   - LLM: Claude 3.5 Sonnet (best for technical writing)
   ↓
5. Structure & Validate
   - Ensure all sections present
   - Validate requirement format (SHALL/SHOULD/MAY)
   - Add traceability IDs
   - Check for ambiguity
   ↓
6. Format as Document
   - Markdown with proper sections
   - Requirement numbering (REQ-001, REQ-002)
   - Tables for acceptance criteria
   - Diagrams (Mermaid) for flows
   ↓
7. Progress Updates (Real-Time)
   - "Analyzing feature description..."
   - "Generating functional requirements..."
   - "Creating acceptance criteria..."
   - "Finalizing document..."
   ↓
8. Final Callback
   - Send complete requirements document
   - Include metadata (requirement count, coverage score)
```

**Example Requirements Output:**
```markdown
# Technical Requirements: User Authentication System

## 1. Overview
This document specifies the technical requirements for implementing a user authentication system with email/password and OAuth support.

## 2. Functional Requirements

### FR-001: User Registration
**Priority:** High
**Status:** Draft

The system SHALL allow users to register using email and password.

**Acceptance Criteria:**
- [ ] Email must be validated (format and uniqueness)
- [ ] Password must meet complexity requirements (8+ chars, uppercase, lowercase, number)
- [ ] User receives email verification link
- [ ] Account is inactive until email verified
- [ ] Registration form includes CAPTCHA to prevent bots

**Edge Cases:**
- Duplicate email registration attempts → Show "Email already exists"
- Email service down → Queue verification email for retry
- Verification link expired → Allow user to request new link

### FR-002: OAuth Authentication
The system SHALL support OAuth 2.0 authentication via Google and GitHub providers.

...

## 3. Non-Functional Requirements

### NFR-001: Security
- Passwords SHALL be hashed using bcrypt with cost factor 12
- Sessions SHALL expire after 30 days of inactivity
- Failed login attempts SHALL be rate-limited (max 5 per hour per IP)

### NFR-002: Performance
- Login SHALL complete within 500ms (95th percentile)
- Registration SHALL complete within 1 second (95th percentile)

...

## 4. Data Requirements

### User Table Schema
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary Key | Unique user identifier |
| email | VARCHAR(255) | Unique, Not Null | User email address |
| password_hash | VARCHAR(255) | Not Null | Bcrypt hashed password |
| email_verified | BOOLEAN | Default: false | Email verification status |
| created_at | TIMESTAMP | Not Null | Account creation timestamp |

...

## 5. Integration Requirements
- Email service: SendGrid or AWS SES
- OAuth providers: Google OAuth 2.0, GitHub OAuth
- Rate limiting: Redis-based limiter

## 6. Testing Requirements
- Unit test coverage: minimum 80%
- Integration tests for all authentication flows
- Load testing: support 1000 concurrent logins

---

**Generated by:** Requirements Writer Agent
**Requirement Count:** 12 functional, 8 non-functional
**Coverage Score:** 95%
```

**Agent Configuration:**
```typescript
{
  slug: 'requirements_writer',
  name: 'Requirements Writer Agent',
  description: 'Automated technical requirements generation from natural language',
  agent_type: 'api',
  config: {
    api: {
      webhook_url: 'http://localhost:5678/webhook/requirements-writer',
      auth_type: 'bearer',
      auth_token: '${N8N_WEBHOOK_TOKEN}',
      timeout_ms: 120000, // 2 minutes
      supports_progress_updates: true,
      progress_callback_url: 'http://localhost:7100/api/agent-to-agent/api-progress/:taskId'
    },
    systemPrompt: `You are a Technical Requirements Writer following IEEE 830 and ISO/IEC/IEEE 29148 standards.

Your job is to convert feature descriptions into comprehensive technical requirements documents with:

1. Functional Requirements (FR-XXX)
   - Use SHALL for mandatory, SHOULD for recommended, MAY for optional
   - Include acceptance criteria for each requirement
   - Document edge cases and error handling

2. Non-Functional Requirements (NFR-XXX)
   - Security, Performance, Scalability, Usability
   - Measurable targets with metrics

3. Data Requirements
   - Database schemas with field definitions
   - Data validation rules
   - Data migration requirements

4. Integration Requirements
   - External services and APIs
   - Authentication and authorization

5. Testing Requirements
   - Unit test expectations
   - Integration test scenarios
   - Performance benchmarks

Always:
- Number requirements for traceability (REQ-001, REQ-002...)
- Include acceptance criteria as checklists
- Document edge cases
- Specify constraints and assumptions
- Add diagrams (Mermaid) for complex flows`
  },
  execution_profile: 'autonomous_build',
  execution_capabilities: {
    can_plan: false,
    can_build: true,
    can_orchestrate: false
  },
  source: 'database',
  status: 'active'
}

## Testing Plan

### Manual Testing Checklist

**Metrics Agent:**
- [ ] Start conversation with metrics_agent
- [ ] Request: "Show me metrics from last 24 hours"
- [ ] Verify task created with status: pending
- [ ] Verify webhook called to n8n
- [ ] Verify task status updates to running
- [ ] Wait for n8n to complete
- [ ] Verify callback received
- [ ] Verify task status updates to completed
- [ ] Verify result displayed in conversation
- [ ] Verify deliverable created (if applicable)

**Marketing Swarm Agent:**
- [ ] Request: "Analyze our competitor landscape"
- [ ] Verify complex workflow executes
- [ ] Verify multiple sub-steps complete
- [ ] Verify aggregated result returned

**Requirements Writer Agent:**
- [ ] Request: "Write requirements for user authentication"
- [ ] Verify structured requirements generated
- [ ] Verify deliverable created

**Error Handling:**
- [ ] Test timeout (webhook doesn't respond)
- [ ] Test n8n workflow error
- [ ] Test invalid callback payload
- [ ] Test network failure

### Automated Testing
- Unit tests for ApiAgentRunnerService
- Unit tests for callback endpoint
- Integration test: full webhook → callback flow (mock n8n)
- E2E test: real n8n workflow execution (dev environment)

## Security Considerations

1. **Webhook Authentication**
   - Use bearer token for n8n webhooks
   - Validate token in n8n workflow
   - Rotate tokens periodically

2. **Callback Validation**
   - Verify callback signature/token
   - Validate task ID exists
   - Rate limiting on callback endpoint

3. **Data Privacy**
   - Don't send PII to n8n (or pseudonymize)
   - Respect user data sovereignty
   - Audit logging for API calls

## Risks & Mitigations

### Risk: n8n downtime breaks agents
**Mitigation:** Health checks, timeout handling, graceful error messages

### Risk: Webhook callbacks lost
**Mitigation:** Retry logic, task expiration cleanup

### Risk: Complex workflows hard to debug
**Mitigation:** Extensive logging, n8n execution history, structured error responses

### Risk: Long execution times frustrate users
**Mitigation:** Progress updates, realistic timeouts, "this may take a minute" messaging

## Timeline Estimate
- ApiAgentRunnerService implementation: 2 days
- Callback endpoint: 1 day
- n8n workflows (3 agents): 3 days
- Agent configuration: 1 day
- Frontend async handling: 1 day
- Testing & bug fixes: 2 days
- **Total: 10 days**

## Dependencies
- Phase 1 & 2 complete ✅
- n8n instance running ✅
- n8n workflow sync system ✅
- Database agent architecture ✅

## Definition of Done
- [ ] ApiAgentRunnerService implemented
- [ ] Callback endpoint working
- [ ] 3 n8n workflows created and synced to git
- [ ] All 3 API agents working end-to-end
- [ ] Async execution with status updates
- [ ] Timeout handling
- [ ] Error handling for workflow failures
- [ ] Manual testing checklist complete
- [ ] Documentation for creating new API agents
- [ ] Code reviewed and merged

## Documentation Deliverables
- API agent creation guide
- n8n workflow template
- Webhook payload specification
- Callback endpoint specification
- Troubleshooting guide

## Notes
API agents allow us to offload complex logic to n8n without bloating the monolith. This architecture supports future expansion - any complex workflow can become an API agent.

Future enhancements:
- Progress callbacks (multi-step workflows)
- Streaming responses
- Workflow versioning and rollback
- A/B testing different workflow versions

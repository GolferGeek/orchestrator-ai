# Direct Agent Access - Product Requirements Document

## Executive Summary

This document outlines the architectural evolution of the Orchestrator AI system from an orchestrator-centric model to a hybrid model that allows direct agent access while maintaining orchestrator capabilities. The new architecture enables users to interact directly with specialized agents while preserving conversation history, task tracking, and real-time progress visibility.

## Table of Contents

1. [Background](#background)
2. [Current State](#current-state)
3. [Proposed Architecture](#proposed-architecture)
4. [Database Schema](#database-schema)
5. [API Specifications](#api-specifications)
6. [Real-Time Task Progress](#real-time-task-progress)
7. [Frontend Requirements](#frontend-requirements)
8. [Implementation Phases](#implementation-phases)
9. [Success Criteria](#success-criteria)

## Background

### Problem Statement
Currently, all agent interactions flow through the orchestrator, creating a bottleneck and preventing direct specialized agent access. Users cannot:
- View all available agents in the system
- Interact directly with specific agents
- Track conversation history per agent
- Monitor long-running task progress in real-time
- See task metadata and evaluations

### Solution Overview
Implement a hybrid architecture where:
- Users can list and directly access all agents (including the orchestrator)
- Each agent maintains its own conversation history
- Tasks are persisted with full lifecycle tracking
- Real-time progress updates via WebSockets/SSE
- Hierarchical UI shows agents, conversations, and tasks

## Current State

### Architecture
- **Orchestrator-Only Pattern**: All requests flow through orchestrator
- **Session Management**: Sessions and messages tables track orchestrator conversations
- **Task Management**: In-memory only via TaskLifecycleService
- **No Direct Access**: Agents not directly accessible with session context

### Database Schema
```sql
-- Existing tables
sessions (id, profile_id, name, created_at, updated_at)
messages (id, session_id, profile_id, role, content, timestamp, order, metadata)
```

### Limitations
- No agent-specific conversation tracking
- No task persistence
- No real-time progress visibility
- Single point of interaction (orchestrator)

## Proposed Architecture

### Hybrid Model
1. **Direct Agent Access**: Users can interact directly with any agent
2. **Orchestrator Preserved**: Orchestrator remains available for complex multi-agent workflows
3. **Conversation Tracking**: Each agent maintains conversation history
4. **Task Persistence**: All tasks stored in database with full lifecycle
5. **Real-Time Updates**: WebSocket/SSE for progress tracking

### Key Components

#### Agent Conversations
- Track which agent handles each conversation segment
- Record handoff reasons and context summaries
- Link to sessions for backward compatibility

#### Tasks
- Persist all agent tasks with status tracking
- Store prompts, responses, evaluations, and metadata
- Enable query and analysis of historical tasks

#### Real-Time Progress
- WebSocket gateway for bi-directional communication
- SSE endpoints for one-way progress streaming
- Progress events: created, updated, completed, failed

## Database Schema

### agent_conversations Table
```sql
CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL, -- 'specialist', 'orchestrator', 'external', 'api'
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_agent_conversations_profile ON public.agent_conversations(profile_id);
CREATE INDEX idx_agent_conversations_agent ON public.agent_conversations(agent_name, agent_type);
CREATE INDEX idx_agent_conversations_active ON public.agent_conversations(profile_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_agent_conversations_last_active ON public.agent_conversations(last_active_at DESC);

-- Auto-update trigger
CREATE TRIGGER update_agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### tasks Table
```sql
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Request fields
    method TEXT NOT NULL,
    prompt TEXT NOT NULL,
    params JSONB DEFAULT '{}'::jsonb,
    -- Response fields
    response TEXT,
    response_metadata JSONB DEFAULT '{}'::jsonb,
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message TEXT,
    -- Evaluation fields
    evaluation JSONB DEFAULT '{}'::jsonb, -- Stores evaluation results
    llm_metadata JSONB DEFAULT '{}'::jsonb, -- Stores LLM usage, model info, etc.
    -- Error tracking
    error_code TEXT,
    error_message TEXT,
    error_data JSONB,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_seconds INTEGER DEFAULT 300,
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_tasks_conversation ON public.tasks(agent_conversation_id);
CREATE INDEX idx_tasks_profile ON public.tasks(profile_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created ON public.tasks(created_at DESC);
CREATE INDEX idx_tasks_method ON public.tasks(method);

-- Auto-update trigger
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration Notes
- Keep existing sessions/messages tables for orchestrator backward compatibility
- Link agent_conversations to sessions when initiated through orchestrator
- Migrate historical data if needed

## API Specifications

### Agent Conversation Endpoints

#### List Agent Conversations
```
GET /api/agent-conversations
Query params:
  - profile_id: UUID (required)
  - agent_name: string (optional)
  - agent_type: string (optional)
  - active_only: boolean (optional, default: false)
  - limit: number (optional, default: 50)
  - offset: number (optional, default: 0)

Response:
{
  conversations: [{
    id: string,
    agent_name: string,
    agent_type: string,
    started_at: string,
    last_active_at: string,
    task_count: number,
    metadata: object
  }],
  total: number
}
```

#### Get Conversation Details
```
GET /api/agent-conversations/:id
Response:
{
  id: string,
  agent_name: string,
  agent_type: string,
  started_at: string,
  ended_at: string | null,
  last_active_at: string,
  tasks: Task[], // Recent tasks
  metadata: object
}
```

### Task Management Endpoints

#### Create Task (Direct Agent Call)
```
POST /api/agents/:type/:name/tasks
Headers:
  - Authorization: Bearer <token>
Body:
{
  method: string,
  prompt: string,
  params?: object,
  conversation_id?: string, // Optional, creates new if not provided
  timeout_seconds?: number
}

Response:
{
  task_id: string,
  conversation_id: string,
  status: 'pending' | 'running',
  created_at: string
}
```

#### List Tasks
```
GET /api/tasks
Query params:
  - conversation_id: UUID (optional)
  - profile_id: UUID (optional)
  - status: string (optional)
  - limit: number (optional, default: 50)
  - offset: number (optional, default: 0)

Response:
{
  tasks: Task[],
  total: number
}
```

#### Get Task Details
```
GET /api/tasks/:id
Response:
{
  id: string,
  conversation_id: string,
  method: string,
  prompt: string,
  response: string | null,
  status: string,
  progress: number,
  progress_message: string | null,
  evaluation: object | null,
  llm_metadata: object | null,
  created_at: string,
  completed_at: string | null
}
```

#### Cancel Task
```
DELETE /api/tasks/:id
Response:
{
  success: boolean,
  message: string
}
```

#### Get Task Progress (SSE)
```
GET /api/tasks/:id/progress
Content-Type: text/event-stream

Events:
data: {"progress": 25, "message": "Processing step 1 of 4"}
data: {"progress": 50, "message": "Analyzing content"}
data: {"progress": 100, "message": "Task completed", "status": "completed"}
```

## Real-Time Task Progress

### WebSocket Implementation

#### Gateway Events
```typescript
// Client -> Server
'task:subscribe': { task_id: string }
'task:unsubscribe': { task_id: string }

// Server -> Client
'task:created': { task_id: string, conversation_id: string }
'task:progress': { task_id: string, progress: number, message?: string }
'task:completed': { task_id: string, result: any }
'task:failed': { task_id: string, error: any }
```

#### Connection Management
- Authentication via JWT token in handshake
- Auto-reconnect with exponential backoff
- Room-based subscriptions per user

### SSE Alternative
For environments where WebSockets are not available:
- Long-polling fallback
- Progress endpoint with event stream
- Automatic reconnection handling

## Frontend Requirements

### Tree Control UI

#### Structure
```
📁 Agents
  📁 Orchestrator
    🤖 orchestrator
      💬 Conversation 1 (2 hours ago)
      💬 Conversation 2 (Yesterday)
  📁 Specialists
    🤖 blog_post_writer
      💬 Tech Article Draft (1 hour ago)
      💬 Marketing Post (3 days ago)
    🤖 code_analyzer
      💬 Security Review (Today)
  📁 API Agents
    🤖 github_integration
      💬 PR Analysis (30 min ago)
  📁 External Agents
    🤖 custom_agent
      💬 Data Processing (Running...)
```

#### Features
1. **Agent List View**
   - Grouped by agent type
   - Show agent description on hover
   - Icon indicates agent status

2. **Conversation View**
   - Show relative timestamps
   - Active/completed status
   - Task count badge

3. **Task Table View** (when conversation selected)
   - Columns: Prompt (truncated), Response preview, Status, Progress, Actions
   - Expandable rows for full content
   - Metadata/evaluation viewer
   - Real-time progress updates

### UI Components

#### TaskProgressBar
```vue
<TaskProgressBar 
  :task-id="taskId"
  :initial-progress="0"
  show-message
  auto-update
/>
```

#### AgentTreeView
```vue
<AgentTreeView
  :agents="agents"
  :conversations="conversations"
  @select-conversation="onConversationSelect"
  @create-conversation="onCreateConversation"
/>
```

#### TaskTable
```vue
<TaskTable
  :tasks="tasks"
  :show-evaluation="true"
  :show-metadata="true"
  @view-details="onViewTaskDetails"
/>
```

## Implementation Phases

### Phase 1: Database and Core Services (Week 1)
- [ ] Create database migrations
- [ ] Implement AgentConversationsService
- [ ] Extend TaskLifecycleService with persistence
- [ ] Update agent base classes for task tracking

### Phase 2: API Endpoints (Week 1-2)
- [ ] Implement conversation management endpoints
- [ ] Add task CRUD endpoints
- [ ] Update DynamicAgentsController for direct access
- [ ] Add authentication/authorization

### Phase 3: WebSocket/SSE Infrastructure (Week 2)
- [ ] Setup WebSocket gateway
- [ ] Implement task progress events
- [ ] Add SSE endpoints as fallback
- [ ] Create progress tracking in agents

### Phase 4: Frontend Implementation (Week 3)
- [ ] Create tree control component
- [ ] Implement task table with real-time updates
- [ ] Add WebSocket client service
- [ ] Build conversation/task viewers

### Phase 5: Integration and Testing (Week 4)
- [ ] Integrate with existing agents
- [ ] Update marketing swarm for progress tracking
- [ ] End-to-end testing
- [ ] Performance optimization

### Phase 6: Migration and Deployment
- [ ] Data migration strategy
- [ ] Backward compatibility testing
- [ ] Documentation updates
- [ ] Gradual rollout plan

## Success Criteria

### Functional Requirements
- [ ] Users can view all available agents in hierarchical tree
- [ ] Direct agent interaction without orchestrator
- [ ] Full conversation history per agent
- [ ] Real-time task progress visibility
- [ ] Task metadata and evaluation access

### Performance Requirements
- [ ] WebSocket connection established < 1 second
- [ ] Task progress updates < 100ms latency
- [ ] Tree view loads < 500ms for 100 agents
- [ ] Support 1000 concurrent WebSocket connections

### User Experience
- [ ] Intuitive navigation between agents and conversations
- [ ] Clear task status and progress indicators
- [ ] Responsive UI with loading states
- [ ] Graceful degradation without WebSockets

### Technical Requirements
- [ ] Database migrations run without data loss
- [ ] API backward compatibility maintained
- [ ] WebSocket authentication secure
- [ ] Comprehensive error handling

## Appendix

### A2A Protocol Compliance
The task management system will comply with A2A protocol specifications:
- Standard task lifecycle states
- JSON-RPC compatible endpoints
- Agent capability discovery
- Long-running task support

### Security Considerations
- JWT authentication for all endpoints
- User isolation for conversations/tasks
- Rate limiting on API endpoints
- WebSocket connection limits per user

### Monitoring and Analytics
- Task completion rates by agent
- Average task duration metrics
- WebSocket connection stability
- Error rates and patterns
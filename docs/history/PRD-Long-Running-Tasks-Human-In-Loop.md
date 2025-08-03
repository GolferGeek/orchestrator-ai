# Product Requirements Document: Long-Running Tasks with Human-in-the-Loop

## Project Overview
**Project Name**: Four-Entity Model for Long-Running Tasks with Human-in-the-Loop  
**Goal**: Transform the current task system into a comprehensive multi-agent orchestration platform with real-time communication and human intervention capabilities  
**Date**: January 2025  
**Status**: In Development  

## Problem Statement

The current system has architectural inconsistencies between sessions/messages and agent conversations/tasks, making it difficult to:
- Track progress in complex multi-agent workflows
- Enable human intervention during task execution  
- Distinguish between communication messages and final deliverables
- Provide real-time visibility into long-running processes

## Solution: Four-Entity Model

### Core Entities

1. **Conversations**: Top-level context between user and agents
2. **Tasks**: Discrete work units with lifecycle management
3. **Messages**: Communication units (conversation-level and task-level)
4. **Deliverables**: Structured, final outputs that provide value

### Entity Relationships

```
Conversation
├── Message (conversation-level)
├── Task
│   ├── Message (task-level communication)
│   ├── Human Input (when needed)
│   └── Deliverable (final structured output)
└── Message (post-task conversation)
```

### Key Insight: Messages at Multiple Levels

Messages can exist at different levels:

**A. Conversation-Level Messages**
- User: "I need help with marketing for my startup"
- System: "I can help with that. What kind of marketing are you thinking about?"
- User: "I need a comprehensive content strategy"
- System: "Great! Let me create a marketing analysis task for you"

**B. Task-Level Messages**
- *Task starts: "Create marketing strategy"*
- System: "I'm analyzing your target audience... should I focus on B2B or B2C?"
- User: "B2B, enterprise customers"
- System: "Perfect, continuing with enterprise focus..."
- *Task completes with final deliverable*

**C. Post-Task Conversation Messages**
- System: "Here's your marketing strategy. Would you like me to create content for any of these campaigns?"
- User: "Yes, let's start with the blog content strategy"
- System: "I'll create a blog content task for you"

## Technical Architecture

### Database Schema

```sql
-- Enhanced tasks table
ALTER TABLE tasks 
ADD COLUMN deliverable_type TEXT DEFAULT 'text',
ADD COLUMN deliverable_metadata JSONB,
ADD COLUMN status TEXT CHECK (status IN ('pending', 'running', 'waiting_for_human', 'completed', 'failed', 'cancelled'));

-- New task messages table
CREATE TABLE task_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('progress', 'status', 'info', 'warning', 'error')),
  progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Human inputs table
CREATE TABLE human_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('confirmation', 'choice', 'input', 'approval')),
  prompt TEXT NOT NULL,
  options JSONB, -- For multiple choice scenarios
  user_response TEXT,
  response_metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'timeout', 'cancelled')),
  timeout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### WebSocket Events

- `task_created`: New task started
- `task_progress`: Progress updates with messages
- `task_completed`: Task finished successfully
- `task_failed`: Task failed with error
- `task_cancelled`: Task was cancelled
- `human_input_required`: User input needed
- `human_input_response`: User provided response
- `human_input_timeout`: Input timed out
- `task_resumed`: Task continued after human input

### Agent Interface

```typescript
interface MessageEmitter {
  emit(content: string, type?: 'progress' | 'status' | 'info' | 'warning' | 'error', progressPercentage?: number): void;
}

interface HumanLoopService {
  requestHumanInput(taskId: string, prompt: string, options?: any, timeoutSeconds?: number): Promise<any>;
  waitForHumanResponse(inputId: string): Promise<any>;
}

interface AgentResponse {
  response: string;          // The deliverable
  deliverableType?: string;  // Structure metadata
  metadata?: any;
}
```

## Key Features

### Real-time Progress Tracking
- WebSocket-based updates for all task states
- Progress messages with percentage completion
- Granular step-by-step visibility

### Human-in-the-Loop
- Pause tasks to request user input
- Multiple input types: confirmation, choice, text input, approval
- Configurable timeouts with graceful degradation
- Resume tasks after user response

### Multi-Agent Orchestration
- Complex workflows with parallel agent execution
- Agent coordination and load balancing
- Error handling for partial failures

### Backwards Compatibility
- Existing agents work without modification
- Current `task.response` becomes deliverable
- Gradual enhancement path

### Structured Deliverables
- Clear distinction between communication and final outputs
- Versioned, persistent artifacts
- Structured metadata for integration

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Database schema updates
- Enhanced task lifecycle service
- Basic WebSocket message emission
- **Test**: Simple blog post with progress messages

### Phase 2: Human-in-the-Loop (Weeks 3-4)
- Human input service implementation
- WebSocket human interaction events
- Timeout and cancellation handling
- **Test**: Marketing swarm with single human input

### Phase 3: Complex Multi-Agent (Weeks 5-6)
- Marketing swarm enhancement
- Parallel agent execution
- Advanced progress tracking
- **Test**: Complete marketing swarm workflow

### Phase 4: Production Ready (Weeks 7-8)
- Error handling and recovery
- Performance optimization
- Comprehensive testing
- **Test**: All test suites passing

## Test Strategy

### API-First Development
All testing will be done at the API level before UI implementation:

#### Test Suite 1: Simple Agent (Blog Post Writer)
- Basic blog post generation with progress messages
- Error handling and validation
- Deliverable structure validation

#### Test Suite 2: Complex Multi-Agent (Marketing Swarm)
- Complete marketing strategy generation
- Multi-step workflow with progress tracking
- Agent failure and recovery scenarios

#### Test Suite 3: Human-in-the-Loop Scenarios
- Simple human confirmation
- Multiple choice scenarios
- Human input timeouts
- Multiple human inputs in sequence

#### Test Suite 4: WebSocket Event Testing
- Real-time progress updates
- User-specific event routing
- Concurrent user scenarios

#### Test Suite 5: Error Handling and Edge Cases
- Task cancellation
- Database consistency
- Concurrent access patterns

## Success Metrics

### Functional Requirements
- All existing agents work without modification
- Complex tasks show real-time progress
- Human inputs complete within timeout
- Deliverables are properly structured

### Performance Requirements
- WebSocket events delivered < 100ms
- Simple tasks complete < 30 seconds
- Complex tasks complete < 2 minutes
- Database queries optimized for scale

### Quality Requirements
- Zero data integrity issues
- Comprehensive error handling
- Graceful degradation patterns
- Security and validation

## Migration Strategy

### Evolutionary, Not Revolutionary
- Semantic mapping of existing fields
- Gradual enhancement of agents
- Backwards compatibility maintained
- Optional improvements for better UX

### Database Evolution
```sql
-- Phase 1: Add new fields (optional)
ALTER TABLE tasks ADD COLUMN deliverable_type TEXT DEFAULT 'text';
ALTER TABLE tasks ADD COLUMN deliverable_metadata JSONB;

-- Phase 2: Add new tables
CREATE TABLE task_messages (...);
CREATE TABLE human_inputs (...);

-- Phase 3: Eventually deprecate old patterns
-- (but keep for backwards compatibility)
```

### Agent Interface Evolution
```typescript
// Current interface (still works)
interface AgentResponse {
  response: string;
  metadata?: any;
}

// Enhanced interface (optional)
interface AgentResponse {
  response: string;          // Becomes deliverable
  messages?: Message[];      // New intermediate messages
  deliverableType?: string;  // Structure info
  metadata?: any;
}
```

## Risk Mitigation

### Technical Risks
- **Database Migration**: Extensive testing in staging environment
- **WebSocket Performance**: Load testing and connection management
- **Agent Compatibility**: Gradual rollout with fallback mechanisms
- **Human Input Timeouts**: Comprehensive timeout handling and recovery

### Business Risks
- **User Experience**: Gradual rollout with user feedback
- **Performance Impact**: Monitoring and optimization
- **Training Requirements**: Documentation and examples

## Future Enhancements

### LangGraph Integration
- Checkpoint-based state persistence
- Advanced workflow patterns
- Multi-step human loops

### Advanced Features
- Workflow templates for common scenarios
- Performance analytics and optimization
- Custom agent configurations

## Conclusion

This four-entity model provides a solid foundation for building sophisticated multi-agent systems with human-in-the-loop capabilities while maintaining backwards compatibility. The phased approach ensures we can deliver value incrementally while building toward a comprehensive orchestration platform.

The key insight is that most of our agents already return deliverables - we just called them "responses". This project is about clarifying semantics and adding capabilities rather than rewriting everything.

---

**Document Status**: Living document - will be updated as implementation progresses  
**Next Review**: Weekly during implementation phases  
**Owner**: Development Team  
**Stakeholders**: Product, Engineering, UX
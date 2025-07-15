# Session Persistence Implementation Plan

## Overview
This document captures the implementation plan for enabling session-aware direct agent calls, allowing agents to maintain conversation history independently of the orchestrator while preserving session continuity.

## Status: DEFERRED
**Date**: 2025-01-14  
**Reason**: Architecture conversation will change fundamental system design  
**Rollback**: Session persistence changes have been rolled back to clean state  

## Background
The original plan aimed to enable agents to handle session persistence directly, making them truly standalone while maintaining conversation history. This was part of a larger initiative to support A2A long-running tasks and direct agent access.

## Implementation Phases

### Phase 1: Basic Session-Aware Agent Calls

#### Phase 1.1: Inject SessionsService into Agent Base Classes ✅ COMPLETED (Rolled Back)
- **Goal**: Make SessionsService available to all agents through inheritance
- **Implementation**: 
  - Added SessionsService to A2AAgentBaseService constructor as optional dependency
  - All derived agents (Context, Function, External) inherit session capabilities
- **Status**: Implemented and tested, then rolled back due to architecture change

#### Phase 1.2: Update Dynamic Agents Controller 📋 PENDING
- **Goal**: Accept optional sessionId in agent endpoint calls
- **Tasks**:
  - Update `/agents/:type/:name/tasks` endpoint to accept `sessionId` parameter
  - Maintain backward compatibility for stateless calls
  - Pass sessionId through to agent executeTask methods

#### Phase 1.3: Frontend Direct Agent Calls 📋 PENDING
- **Goal**: Enable frontend to call agents directly with session context
- **Tasks**:
  - Update frontend to call orchestrator directly for enhanced messaging
  - Remove sessions service from enhanced messaging chain
  - Preserve session continuity in direct agent calls

### Phase 2: A2A Long-Running Task Support

#### Phase 2.1: Task Management Endpoints 📋 PENDING
- **Goal**: Expose task management through A2A protocol
- **Endpoints**:
  - `GET /agents/:type/:name/tasks` - List active tasks
  - `POST /agents/:type/:name/tasks` - Create new task
  - `DELETE /agents/:type/:name/tasks/:id` - Cancel task

#### Phase 2.2: Task Persistence 📋 PENDING
- **Goal**: Database schema for long-running task storage
- **Schema**: Task tracking with status, progress, results

#### Phase 2.3: Real-time Updates 📋 PENDING
- **Goal**: SSE streaming for task progress
- **Implementation**: Server-sent events for real-time task status

#### Phase 2.4: Webhook Notifications 📋 PENDING
- **Goal**: External notification system
- **Implementation**: Configurable webhooks for task status changes

### Phase 3: Marketing Swarm Integration

#### Phase 3.1: Progress Visibility 📋 PENDING
- **Goal**: Make marketing swarm progress visible through task API
- **Integration**: Connect existing swarm to new task management system

### Phase 4: Frontend UI Enhancements

#### Phase 4.1: Long-Running Task UI 📋 PENDING
- **Goal**: UI components for task monitoring
- **Features**: Progress indicators, task management interface

### Phase 5: A2A Compliance

#### Phase 5.1: Enhanced Agent Cards 📋 PENDING
- **Goal**: Document long-running task capabilities in agent metadata
- **Implementation**: Update agent discovery to include task support

## Technical Implementation Details

### SessionsService Integration Approach (Rolled Back)
```typescript
// A2AAgentBaseService constructor
constructor(
  protected readonly httpService: HttpService,
  // ... other services
  sessionsService?: SessionsService,
) {
  // Make sessionsService available to all derived classes
  this.sessionsService = sessionsService;
}

// Helper methods for session persistence
protected async saveUserMessageToSession(params: any, userMessage: string, method: string): Promise<void>
protected async saveAgentResponseToSession(params: any, response: string, metadata?: any): Promise<void>
```

### Agent Base Class Hierarchy
```
A2AAgentBaseService (base)
├── ContextAgentBaseService (LLM-based processing)
├── FunctionAgentBaseService (function execution)
└── ExternalA2AAgentBaseService (external agent proxy)
```

### Session Persistence Pattern (Attempted)
1. **Before Processing**: Save user message to session with agent metadata
2. **After Processing**: Save agent response to session with execution metadata
3. **Error Handling**: Graceful degradation when session service unavailable

## Architecture Decisions Made

### 1. Base Class Injection
- **Decision**: Inject SessionsService at A2AAgentBaseService level
- **Rationale**: All derived agents inherit session capabilities without modification
- **Alternative Considered**: Individual service injection (rejected as redundant)

### 2. Optional Dependency
- **Decision**: Make SessionsService optional in constructor
- **Rationale**: Maintains backward compatibility and supports stateless operation
- **Implementation**: Graceful degradation when service not available

### 3. Helper Methods
- **Decision**: Provide protected helper methods for session operations
- **Rationale**: Standardized session persistence across all agent types
- **Methods**: `saveUserMessageToSession()`, `saveAgentResponseToSession()`

## Rollback Details

### Changes Reverted
1. **A2AAgentBaseService**: Removed SessionsService import and injection
2. **ContextAgentBaseService**: Removed session persistence calls
3. **FunctionAgentBaseService**: Removed session persistence calls
4. **SessionPersistenceUtil**: Deleted unused utility file

### Clean State Achieved
- All agents back to original session-agnostic state
- No session persistence in agent layer
- Orchestrator maintains exclusive session management
- No breaking changes to existing functionality

## Future Considerations

### Architecture Questions to Address
1. **Session Ownership**: Should agents own session state or remain stateless?
2. **Persistence Layer**: Database vs. in-memory vs. hybrid approach?
3. **Agent Discovery**: How should session capabilities be advertised?
4. **Error Recovery**: How to handle session persistence failures?
5. **Scale**: Multi-instance session consistency requirements?

### Alternative Approaches
1. **Event-Driven**: Session updates via message bus
2. **Proxy Pattern**: Session proxy service between agents and storage
3. **Middleware**: Session middleware in request pipeline
4. **State Management**: External state management service

## References
- [A2A Protocol Specification](https://a2a.ai/)
- [NestJS Dependency Injection](https://docs.nestjs.com/providers)
- [Current Agent Architecture](./current-agent-architecture.md)
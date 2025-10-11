# A2A SSE Protocol Conformance - Product Requirements Document

**Version:** 1.0  
**Date:** October 11, 2025  
**Author:** Development Team  
**Status:** Draft  

## Executive Summary

### Business Context
The open-source A2A (Agent2Agent) protocol specification mandates **Server-Sent Events (SSE)** for real-time streaming capabilities. Our current implementation uses WebSocket (Socket.IO) for streaming, which is not A2A-compliant and creates interoperability barriers with other A2A-compliant systems.

### Strategic Imperative
With A2A becoming an open-source standard, protocol compliance is critical for:
- **Ecosystem Integration**: Interoperability with other A2A-compliant agents
- **Standards Adherence**: Following the official A2A specification
- **Simplified Architecture**: SSE is simpler than WebSocket for unidirectional streaming
- **Browser Compatibility**: Built-in browser support via EventSource API
- **Eliminate Technical Debt**: Remove WebSocket complexity entirely

### Radical Simplification Approach
This is a **complete replacement**, not a migration. We will:
- ❌ **Remove WebSocket completely** - Delete TaskProgressGateway and Socket.IO dependencies
- ✅ **Implement SSE only** - Single, simple streaming protocol
- ✅ **Accept short-term disruption** - 1-2 days of active development
- ✅ **No dual protocol** - Clean architecture, no technical debt
- ✅ **Strong typing throughout** - Maintain our transport-types pattern

### SSE for Real-Time Progress Updates
SSE is **perfect** for tasks that take 1+ minutes with frequent progress updates:
- ✅ **Updates every 5 seconds (or faster)** - SSE handles high-frequency updates
- ✅ **Server pushes to client** - Exactly what SSE was designed for
- ✅ **Automatic reconnection** - Built into EventSource API
- ✅ **Lower overhead** - No WebSocket handshake complexity
- ✅ **HTTP/2 multiplexing** - Multiple streams over single connection

**Example Flow:**
```
Task starts → Open SSE connection
├─ 0s:  event: agent_stream_chunk (progress: 10%)
├─ 5s:  event: agent_stream_chunk (progress: 25%)
├─ 10s: event: agent_stream_chunk (progress: 45%)
├─ 15s: event: agent_stream_chunk (progress: 70%)
├─ 20s: event: agent_stream_chunk (progress: 95%)
└─ 22s: event: agent_stream_complete (progress: 100%)
```

SSE is actually **better** than WebSocket for this because:
- Server → Client only (we don't need client → server during streaming)
- Automatic reconnection if connection drops
- Simpler protocol, less overhead
- Native browser support, no library needed

### Hybrid Storage: In-Memory + Short-Term Database
**We use a practical hybrid approach:**

#### **In-Memory Singleton Service (Active Tasks)**
- ✅ **Fast real-time updates** - Webhook updates stored in memory for active tasks
- ✅ **SSE broadcasts immediately** - No database latency
- ✅ **Automatic cleanup** - Removed when task completes or times out
- ✅ **Current pattern** - Keeps existing webhook controller singleton pattern

#### **Short-Term Database Storage (Recent History)**
- ✅ **SSE reconnection** - Clients can catch up on missed messages (last 10-15 mins)
- ✅ **Polling fallback** - HTTP polling gets recent updates for non-SSE clients
- ✅ **External webhook persistence** - n8n updates stored briefly
- ✅ **Automatic expiration** - Messages deleted after:
  - Task completes + 10 minutes, OR
  - Message age > 1 hour (whichever comes first)

**How it works:**
```typescript
// 1. Webhook arrives → Store in BOTH places
webhookUpdate() {
  // In-memory (real-time)
  this.activeTasksService.updateTask(taskId, update);
  
  // Database (short-term history)
  await this.taskMessageService.createMessage(taskId, update, {
    ttl: '1 hour' // Auto-delete after 1 hour
  });
  
  // Broadcast to SSE listeners
  this.eventEmitter.emit('agent.stream.chunk', event);
}

// 2. SSE client connects → Gets live updates from in-memory
// 3. SSE client reconnects → Gets missed updates from database (last 10 mins)
// 4. Polling client → Gets updates from database

// 5. Background job cleans up expired messages
@Cron('*/15 * * * *') // Every 15 minutes
async cleanupExpiredMessages() {
  await this.taskMessageService.deleteExpiredMessages();
}
```

**Benefits:**
- 🚀 Real-time performance (in-memory)
- 🔄 Reconnection support (short-term DB)
- 🔌 Polling fallback (short-term DB)
- 🧹 No long-term bloat (auto-cleanup)
- ✅ Keeps existing singleton pattern

### Storage Strategy for Different Orchestration Patterns

The three-tier system handles ALL orchestration scenarios:

#### **Short-Term Agent Tasks (Seconds to Minutes)**
```typescript
// Context agents, API agents executing single tasks
// Example: "Generate blog post" - completes in 30 seconds
```
- ✅ **In-memory:** All progress updates
- ✅ **Short-term DB (1 hour TTL):** For reconnection/polling
- ✅ **Long-term DB:** Final result only (tasks table)

#### **Short-Term Orchestrations (Minutes)**
```typescript
// Multi-agent workflows completing quickly
// Example: "Marketing swarm" - 3-5 agents, completes in 2-5 minutes
```
- ✅ **In-memory:** Active orchestration state
- ✅ **Short-term DB (1 hour TTL):** Step-by-step progress
- ✅ **Long-term DB:** Orchestration run record, final deliverable (orchestration_runs table)

#### **Long-Term Orchestrations (Hours to Weeks)**
```typescript
// Complex, multi-day orchestrations
// Example: "Build entire application" - May take days/weeks
```
- ⚠️ **In-memory:** Only currently active step (not entire orchestration)
- ✅ **Short-term DB (1 hour TTL):** Recent step updates
- ✅ **Long-term DB:** REQUIRED for orchestration state
  - `orchestration_runs` table - Orchestration metadata, status
  - `orchestration_steps` table - Each step's state (not deleted)
  - `orchestration_checkpoints` table - Resume points
  - `task_messages` table - Recent progress (TTL cleanup still applies)

**Key Insight:**
- **Progress messages** (interim updates) → Short-term storage with TTL
- **Orchestration state** (steps, checkpoints) → Long-term storage
- **Final results** → Long-term storage

This means:
- ✅ Fast real-time updates for all orchestration types
- ✅ No bloat from progress messages (TTL cleanup)
- ✅ Persistent state for long-running orchestrations
- ✅ Can pause/resume orchestrations that take days/weeks

## Current State Analysis

### What We Built vs. What A2A Requires

| Component | Our Implementation | A2A Specification | Compliance |
|-----------|-------------------|-------------------|------------|
| **Streaming Protocol** | WebSocket (Socket.IO) | SSE (text/event-stream) | ❌ 0% |
| **Task Endpoint** | `POST /agent-to-agent/:org/:agent/tasks` | Same + SSE streaming | ⚠️ 50% |
| **Stream Endpoint** | `ws://<api>/task-progress` namespace | `GET /agent-to-agent/:org/:agent/tasks/:taskId/stream` | ❌ 0% |
| **Frontend Client** | Socket.IO client | EventSource API | ❌ 0% |
| **Transport Types** | WebSocket events (untyped) | Need SSE event types | ❌ 0% |
| **Human Task System** | Has SSE (`GET /tasks/:id/progress`) | ✅ Correct pattern | ✅ 100% |

**Overall Compliance: ~15%** - We have the right concepts but wrong transport protocol for A2A.

### Technical Debt Assessment

#### **What Works Well:**
1. ✅ **SSE Pattern Exists** - Already implemented in `TasksController.streamTaskProgress()` for human-facing tasks
2. ✅ **Event System** - EventEmitter2 infrastructure for internal event propagation
3. ✅ **Stream Service** - `AgentRuntimeStreamService` handles streaming logic
4. ✅ **Strong Typing** - `@orchestrator-ai/transport-types` package for shared types

#### **What Needs Work:**
1. ❌ **A2A Controller** - No SSE endpoint exposed for agent-to-agent streaming
2. ❌ **Frontend** - Uses WebSocket client instead of EventSource
3. ❌ **Transport Types** - Missing SSE event type definitions
4. ❌ **WebSocket Gateway** - Must be removed completely (TaskProgressGateway, Socket.IO)

### Files to Delete (Complete List)

#### **Backend - DELETE:**
- `apps/api/src/agent-platform/websocket/task-progress.gateway.ts` (~550 lines)
- `apps/api/src/agent-platform/websocket/task-progress.gateway.spec.ts` (~100 lines)
- Remove from `apps/api/src/agent-platform/agent-platform.module.ts` imports
- Remove from `apps/api/package.json`: `@nestjs/websockets`, `socket.io`

#### **Backend - KEEP (Critical):**
- ✅ `apps/api/src/agent2agent/tasks/tasks.controller.ts` - Includes polling endpoint
- ✅ `apps/api/src/agent2agent/tasks/tasks.service.ts` - Task management
- ✅ `apps/api/src/agent2agent/tasks/task-message.service.ts` - Message persistence with TTL
- ✅ `apps/api/src/agent2agent/tasks/task-status.service.ts` - Status tracking
- ✅ **Webhook singleton service** - In-memory active task tracking (existing pattern)
- ✅ Webhook endpoints for external systems (n8n, etc.)
- ✅ `GET /tasks/:id/messages` - Polling endpoint for non-SSE clients
- ✅ `task_messages` database table - Short-term storage with `expires_at` column

#### **Frontend - DELETE:**
- WebSocket connection logic in `apps/web/src/stores/agentChatStore/store.ts` (~200 lines)
- Any WebSocket utility composables (if they exist)
- Remove from `apps/web/package.json`: `socket.io-client`

**Total Deletion: ~850+ lines of WebSocket code**  
**Preserved: Task messages system for polling fallback (~1000 lines)**

## Technical Requirements

### Phase 1: Transport Types Package Enhancement

#### **R1: SSE Event Type Definitions**
**Priority:** Critical  
**Location:** `apps/transport-types/streaming/sse-events.types.ts`

```typescript
/**
 * SSE Event Types for A2A Streaming
 * Specification: https://google.github.io/A2A/specification/
 */

/**
 * Base SSE Event
 * All SSE events follow this structure
 */
export interface BaseSSEEvent {
  /** Event type identifier */
  event: string;
  /** Event data payload */
  data: any;
  /** Optional event ID for replay */
  id?: string;
  /** Optional retry interval in milliseconds */
  retry?: number;
}

/**
 * Agent Stream Chunk Event
 * Emitted during streaming execution (can be sent every few seconds for progress updates)
 */
export interface AgentStreamChunkSSEEvent extends BaseSSEEvent {
  event: 'agent_stream_chunk';
  data: {
    /** Unique stream identifier */
    streamId: string;
    /** Chunk data */
    chunk: {
      /** Chunk type: partial (incremental) or final (complete) */
      type: 'partial' | 'final';
      /** Chunk content (can be incremental text or progress update) */
      content: string;
      /** Optional metadata (includes progress percentage, step info, etc.) */
      metadata?: {
        /** Progress percentage (0-100) */
        progress?: number;
        /** Current step/phase description */
        step?: string;
        /** Additional context */
        [key: string]: any;
      };
    };
    /** Associated conversation ID */
    conversationId?: string;
    /** Associated orchestration run ID */
    orchestrationRunId?: string;
    /** Organization slug */
    organizationSlug: string | null;
    /** Agent slug */
    agentSlug: string;
    /** Task mode */
    mode: string;
    /** Timestamp */
    timestamp: string;
  };
}

/**
 * Agent Stream Complete Event
 * Emitted when stream completes successfully
 */
export interface AgentStreamCompleteSSEEvent extends BaseSSEEvent {
  event: 'agent_stream_complete';
  data: {
    /** Unique stream identifier */
    streamId: string;
    /** Type indicator */
    type: 'complete';
    /** Associated conversation ID */
    conversationId?: string;
    /** Associated orchestration run ID */
    orchestrationRunId?: string;
    /** Organization slug */
    organizationSlug: string | null;
    /** Agent slug */
    agentSlug: string;
    /** Task mode */
    mode: string;
    /** Timestamp */
    timestamp: string;
  };
}

/**
 * Agent Stream Error Event
 * Emitted when stream encounters an error
 */
export interface AgentStreamErrorSSEEvent extends BaseSSEEvent {
  event: 'agent_stream_error';
  data: {
    /** Unique stream identifier */
    streamId: string;
    /** Type indicator */
    type: 'error';
    /** Error message */
    error: string;
    /** Associated conversation ID */
    conversationId?: string;
    /** Associated orchestration run ID */
    orchestrationRunId?: string;
    /** Organization slug */
    organizationSlug: string | null;
    /** Agent slug */
    agentSlug: string;
    /** Task mode */
    mode: string;
    /** Timestamp */
    timestamp: string;
  };
}

/**
 * Task Progress Event (for human-facing tasks)
 * Emitted for task status updates
 */
export interface TaskProgressSSEEvent extends BaseSSEEvent {
  event: 'task_progress';
  data: {
    /** Task ID */
    taskId: string;
    /** Progress percentage (0-100) */
    progress: number;
    /** Progress message */
    message?: string;
    /** Task status */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    /** Timestamp */
    timestamp: string;
  };
}

/**
 * Union type of all SSE events
 */
export type SSEEvent =
  | AgentStreamChunkSSEEvent
  | AgentStreamCompleteSSEEvent
  | AgentStreamErrorSSEEvent
  | TaskProgressSSEEvent;

/**
 * SSE Event Handler Type
 */
export type SSEEventHandler<T extends SSEEvent = SSEEvent> = (event: T) => void;

/**
 * SSE Connection Options
 */
export interface SSEConnectionOptions {
  /** Reconnection attempts before giving up */
  maxReconnectAttempts?: number;
  /** Delay between reconnection attempts (ms) */
  reconnectDelay?: number;
  /** Connection timeout (ms) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * SSE Connection State
 */
export type SSEConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'error';
```

#### **R2: Export SSE Types from Package**
**Priority:** Critical  
**Location:** `apps/transport-types/index.ts`

```typescript
// Add to existing exports
export {
  BaseSSEEvent,
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
  TaskProgressSSEEvent,
  SSEEvent,
  SSEEventHandler,
  SSEConnectionOptions,
  SSEConnectionState,
} from './streaming/sse-events.types';
```

### Phase 2: Backend SSE Implementation

#### **R3: A2A Controller SSE Endpoint**
**Priority:** Critical  
**Location:** `apps/api/src/agent2agent/agent2agent.controller.ts`

```typescript
/**
 * Stream agent task execution via SSE
 * GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream
 * 
 * A2A Protocol Compliant - SSE streaming endpoint
 */
@Get('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream')
@UseGuards(JwtAuthGuard)
async streamAgentTask(
  @Param('orgSlug') orgSlug: string,
  @Param('agentSlug') agentSlug: string,
  @Param('taskId') taskId: string,
  @Query('streamId') streamId: string,
  @CurrentUser() currentUser: SupabaseAuthUserDto,
  @Res() response: Response,
) {
  // Set SSE headers (A2A compliant)
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
  });

  try {
    // Subscribe to stream events
    const eventHandler = (event: AgentStreamChunkEvent | AgentStreamCompleteEvent | AgentStreamErrorEvent) => {
      if (event.streamId !== streamId) return;

      // Format as SSE event
      const sseEvent = this.formatSSEEvent(event);
      response.write(`event: ${sseEvent.event}\ndata: ${JSON.stringify(sseEvent.data)}\n\n`);

      // End stream on complete or error
      if (event.type === 'complete' || event.type === 'error') {
        response.end();
      }
    };

    // Subscribe to relevant events
    this.eventEmitter.on('agent.stream.chunk', eventHandler);
    this.eventEmitter.on('agent.stream.complete', eventHandler);
    this.eventEmitter.on('agent.stream.error', eventHandler);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      response.write(': keepalive\n\n');
    }, 30000);

    // Cleanup on client disconnect
    response.on('close', () => {
      clearInterval(keepAlive);
      this.eventEmitter.off('agent.stream.chunk', eventHandler);
      this.eventEmitter.off('agent.stream.complete', eventHandler);
      this.eventEmitter.off('agent.stream.error', eventHandler);
    });
  } catch (error) {
    this.logger.error('SSE streaming error:', error);
    response.write(`event: error\ndata: ${JSON.stringify({
      error: 'Stream failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })}\n\n`);
    response.end();
  }
}

/**
 * Format internal events as SSE events (strongly typed)
 */
private formatSSEEvent(
  event: AgentStreamChunkEvent | AgentStreamCompleteEvent | AgentStreamErrorEvent
): AgentStreamChunkSSEEvent | AgentStreamCompleteSSEEvent | AgentStreamErrorSSEEvent {
  const baseData = {
    streamId: event.streamId,
    conversationId: event.conversationId,
    orchestrationRunId: event.orchestrationRunId,
    organizationSlug: event.organizationSlug,
    agentSlug: event.agentSlug,
    mode: event.mode,
    timestamp: new Date().toISOString(),
  };

  if ('chunk' in event) {
    return {
      event: 'agent_stream_chunk',
      data: { ...baseData, chunk: event.chunk },
    };
  } else if ('type' in event && event.type === 'complete') {
    return {
      event: 'agent_stream_complete',
      data: { ...baseData, type: 'complete' },
    };
  } else {
    return {
      event: 'agent_stream_error',
      data: { ...baseData, type: 'error', error: event.error },
    };
  }
}
```

#### **R4: Task Response Includes Stream Endpoint**
**Priority:** High  
**Implementation:** When streaming is requested, include SSE endpoint URL in response metadata

```typescript
// In agent-execution-gateway.service.ts or agent2agent.controller.ts
if (streamId) {
  response.metadata.metadata.streamEndpoint = 
    `/agent-to-agent/${orgSlug}/${agentSlug}/tasks/${taskId}/stream?streamId=${streamId}`;
}
```

#### **R5: Webhook Controller SSE Support**
**Priority:** Medium  
**Location:** Consider if external webhooks (n8n, etc.) need SSE streaming

**Decision Required:** Do external API agents (n8n workflows) need SSE streaming support, or is the existing polling/webhook pattern sufficient for their use case?

### Phase 3: Frontend SSE Client Implementation

#### **R6: SSE Client Service**
**Priority:** Critical  
**Location:** `apps/web/src/services/agent2agent/sse/sseClient.ts`

```typescript
import {
  SSEEvent,
  SSEEventHandler,
  SSEConnectionOptions,
  SSEConnectionState,
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
} from '@orchestrator-ai/transport-types';

/**
 * A2A-Compliant SSE Client
 * Handles Server-Sent Events streaming with strong typing
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private state: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private handlers: Map<string, Set<SSEEventHandler>> = new Map();
  private options: Required<SSEConnectionOptions>;

  constructor(options: SSEConnectionOptions = {}) {
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
    };
  }

  /**
   * Connect to SSE stream endpoint
   */
  connect(url: string, authToken: string): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.warn('SSE: Already connected or connecting');
      return;
    }

    this.state = 'connecting';
    this.log('Connecting to SSE endpoint:', url);

    // EventSource doesn't support custom headers, so append token to URL
    const urlWithAuth = `${url}${url.includes('?') ? '&' : '?'}token=${authToken}`;

    this.eventSource = new EventSource(urlWithAuth);

    // Standard EventSource events
    this.eventSource.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.log('SSE: Connected');
    };

    this.eventSource.onerror = (error) => {
      this.log('SSE: Error', error);
      this.handleError(error);
    };

    // Custom event handlers (strongly typed)
    this.eventSource.addEventListener('agent_stream_chunk', (event) => {
      this.handleTypedEvent('agent_stream_chunk', event);
    });

    this.eventSource.addEventListener('agent_stream_complete', (event) => {
      this.handleTypedEvent('agent_stream_complete', event);
    });

    this.eventSource.addEventListener('agent_stream_error', (event) => {
      this.handleTypedEvent('agent_stream_error', event);
    });
  }

  /**
   * Handle typed SSE event
   */
  private handleTypedEvent(eventType: string, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const typedEvent: SSEEvent = {
        event: eventType as any,
        data,
        id: event.lastEventId,
      };

      this.log('SSE: Received event', eventType, data);
      this.emit(eventType, typedEvent);
    } catch (error) {
      console.error('SSE: Failed to parse event', error);
    }
  }

  /**
   * Handle connection error with reconnection logic
   */
  private handleError(error: Event): void {
    this.state = 'error';

    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.log(`SSE: Reconnecting (attempt ${this.reconnectAttempts})...`);
      
      setTimeout(() => {
        if (this.eventSource) {
          const url = this.eventSource.url;
          this.disconnect();
          // Extract auth token from URL (simple approach)
          const token = new URL(url).searchParams.get('token') || '';
          const baseUrl = url.split('?')[0];
          this.connect(baseUrl, token);
        }
      }, this.options.reconnectDelay * this.reconnectAttempts);
    } else {
      this.log('SSE: Max reconnection attempts reached');
      this.disconnect();
    }
  }

  /**
   * Subscribe to specific event type
   */
  on<T extends SSEEvent>(eventType: T['event'], handler: SSEEventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as SSEEventHandler);
  }

  /**
   * Unsubscribe from event type
   */
  off<T extends SSEEvent>(eventType: T['event'], handler: SSEEventHandler<T>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as SSEEventHandler);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(eventType: string, event: SSEEvent): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    this.log('SSE: Disconnecting');
    this.state = 'disconnected';
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.handlers.clear();
  }

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState {
    return this.state;
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[SSEClient]', ...args);
    }
  }
}
```

#### **R7: Update Agent Chat Store**
**Priority:** Critical  
**Location:** `apps/web/src/stores/agentChatStore/store.ts`

```typescript
import { SSEClient } from '@/services/agent2agent/sse/sseClient';
import {
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
} from '@orchestrator-ai/transport-types';

// Add to store state
interface AgentChatStoreState {
  // ... existing state
  sseClient: SSEClient | null;
  activeStreams: Map<string, { taskId: string; conversationId: string }>;
}

// Replace WebSocket connection logic
export const useAgentChatStore = defineStore('agentChat', {
  state: (): AgentChatStoreState => ({
    // ... existing state
    sseClient: null,
    activeStreams: new Map(),
  }),

  actions: {
    /**
     * Initialize SSE client (replaces WebSocket init)
     */
    initializeSSE() {
      if (this.sseClient) return;

      this.sseClient = new SSEClient({
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        debug: import.meta.env.DEV,
      });

      // Set up event handlers with strong typing
      this.sseClient.on<AgentStreamChunkSSEEvent>('agent_stream_chunk', (event) => {
        this.handleStreamChunk(event.data);
      });

      this.sseClient.on<AgentStreamCompleteSSEEvent>('agent_stream_complete', (event) => {
        this.handleStreamComplete(event.data);
      });

      this.sseClient.on<AgentStreamErrorSSEEvent>('agent_stream_error', (event) => {
        this.handleStreamError(event.data);
      });
    },

    /**
     * Subscribe to agent stream (replaces WebSocket subscription)
     */
    async subscribeToStream(streamId: string, streamEndpoint: string) {
      if (!this.sseClient) {
        this.initializeSSE();
      }

      const authStore = useAuthStore();
      const token = authStore.accessToken;

      if (!token) {
        throw new Error('No auth token available for SSE connection');
      }

      // Connect to SSE endpoint
      this.sseClient!.connect(streamEndpoint, token);
      
      // Track active stream
      this.activeStreams.set(streamId, {
        taskId: streamId,
        conversationId: this.activeConversationId,
      });
    },

    /**
     * Handle stream chunk (strongly typed)
     */
    handleStreamChunk(data: AgentStreamChunkSSEEvent['data']) {
      const conversation = this.conversations.get(data.conversationId!);
      if (!conversation) return;

      // Update streaming message
      if (data.chunk.type === 'partial') {
        this.updateStreamingMessage(conversation.id, data.chunk.content);
      } else if (data.chunk.type === 'final') {
        this.finalizeStreamingMessage(conversation.id, data.chunk.content);
      }
    },

    /**
     * Handle stream complete (strongly typed)
     */
    handleStreamComplete(data: AgentStreamCompleteSSEEvent['data']) {
      console.log('Stream completed:', data.streamId);
      
      // Clean up stream tracking
      this.activeStreams.delete(data.streamId);
      
      // Disconnect if no more active streams
      if (this.activeStreams.size === 0 && this.sseClient) {
        this.sseClient.disconnect();
        this.sseClient = null;
      }
    },

    /**
     * Handle stream error (strongly typed)
     */
    handleStreamError(data: AgentStreamErrorSSEEvent['data']) {
      console.error('Stream error:', data.error);
      
      // Show error to user
      const conversation = this.conversations.get(data.conversationId!);
      if (conversation) {
        this.addErrorMessage(conversation.id, data.error);
      }
      
      // Clean up
      this.activeStreams.delete(data.streamId);
    },

    /**
     * Cleanup on destroy
     */
    cleanup() {
      if (this.sseClient) {
        this.sseClient.disconnect();
        this.sseClient = null;
      }
      this.activeStreams.clear();
    },
  },
});
```

### Phase 4: WebSocket Removal

#### **R8: Remove TaskProgressGateway**
**Priority:** Critical  
**Files to Delete:**
- `apps/api/src/agent-platform/websocket/task-progress.gateway.ts`
- `apps/api/src/agent-platform/websocket/task-progress.gateway.spec.ts`

**Actions:**
- [ ] Remove TaskProgressGateway from AgentPlatformModule imports
- [ ] Remove `@nestjs/websockets` dependency from API package.json
- [ ] Remove `socket.io` dependency from API package.json
- [ ] Delete the entire `apps/api/src/agent-platform/websocket/` directory

#### **R9: Remove Frontend WebSocket Client**
**Priority:** Critical  
**Files to Update:**
- `apps/web/src/stores/agentChatStore/store.ts` - Remove WebSocket connection logic
- `apps/web/src/composables/useWebSocket.ts` - Delete if exists
- `apps/web/package.json` - Remove `socket.io-client` dependency

**Actions:**
- [ ] Remove all WebSocket/Socket.IO import statements
- [ ] Delete WebSocket connection/subscription methods
- [ ] Remove socket state management
- [ ] Clean up any WebSocket-specific utility files

#### **R10: Clean Up Event Listeners**
**Priority:** High  
**Implementation:** Keep EventEmitter2 system (internal), remove WebSocket gateway subscriptions

```typescript
// KEEP: Internal event system (EventEmitter2)
this.eventEmitter.emit('agent.stream.chunk', event);

// REMOVE: WebSocket gateway that listens to these events
// (TaskProgressGateway.handleAgentStreamChunk)

// ADD: Two consumers of the same events
// 1. SSE endpoint broadcasts in real-time (Agent2AgentController.streamAgentTask)
// 2. TaskMessageService stores to database (for polling fallback)
```

#### **R11: Implement Three-Tier Storage**
**Priority:** High  
**Implementation:** In-memory for real-time, short-term DB for history, long-term for final status

```typescript
// In agent-runtime-stream.service.ts
publishChunk(chunk: AgentRuntimeStreamChunk) {
  const event = this.buildChunkEvent(chunk);
  
  // Tier 1: Update in-memory (instant)
  this.activeTasksService.updateTask(event.streamId, {
    lastChunk: chunk,
    progress: chunk.metadata?.progress,
    updatedAt: Date.now(),
  });
  
  // Tier 2: Store to database with TTL (short-term history)
  await this.taskMessageService.createMessage({
    taskId: event.streamId,
    type: 'stream_chunk',
    content: chunk.content,
    metadata: chunk.metadata,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour TTL
  });
  
  // Tier 3: Broadcast to SSE listeners (real-time)
  this.eventEmitter.emit('agent.stream.chunk', event);
}

// When task completes, update final status (keep forever)
async completeTask(taskId: string, result: any) {
  // Tier 1: Remove from in-memory
  this.activeTasksService.deleteTask(taskId);
  
  // Tier 2: Mark messages for deletion in 10 minutes
  await this.taskMessageService.expireMessagesForTask(taskId, 10 * 60 * 1000);
  
  // Tier 3: Store final result (keep forever)
  if (isOrchestration) {
    // For orchestrations: Store step completion in orchestration_steps
    await this.orchestrationService.completeStep(orchestrationRunId, stepId, {
      status: 'completed',
      output: result,
      completedAt: new Date(),
    });
  } else {
    // For single tasks: Store final result in tasks table
    await this.tasksService.updateTask(taskId, {
      status: 'completed',
      result,
      completedAt: new Date(),
    });
  }
}
```

**Example: Long-Running Orchestration (5 days)**
```typescript
// Day 1: Start orchestration
orchestration_run: { status: 'running', current_step: 1 }
task_messages: [progress updates...] // Will be cleaned up

// Day 2: Complete step 1, start step 2
orchestration_steps: [
  { step: 1, status: 'completed', output: '...' } // Kept forever
]
task_messages: [recent progress...] // Old messages cleaned, new ones added

// Day 5: Complete orchestration
orchestration_run: { status: 'completed' } // Kept forever
orchestration_steps: [all steps...] // Kept forever
task_messages: [] // All cleaned up after completion + 10 minutes
```

**Cleanup Strategy Summary:**
- **In-memory:** Clear after 1 minute of inactivity or on completion
- **task_messages table (progress updates):** Delete after 1 hour OR task completion + 10 minutes
- **tasks table (final results):** Keep forever
- **orchestration_runs table:** Keep forever
- **orchestration_steps table:** Keep forever (needed for long-running orchestrations)

**What Gets Deleted (TTL Cleanup):**
- ❌ "Agent started processing..." (progress message)
- ❌ "Step 2 of 5 complete..." (progress message)
- ❌ "60% progress..." (progress message)

**What Gets Kept (Persistent Storage):**
- ✅ Task final result → Forever
- ✅ Orchestration run state → Forever
- ✅ Orchestration step states → Forever
- ✅ Orchestration checkpoints → Forever (for resume capability)

## Implementation Plan

### Day 1: Transport Types & WebSocket Removal

#### **Morning: Transport Types (2-3 hours)**
- [ ] Create `apps/transport-types/streaming/sse-events.types.ts`
- [ ] Add SSE event interfaces (BaseSSEEvent, AgentStreamChunkSSEEvent, etc.)
- [ ] Export types from `apps/transport-types/index.ts`
- [ ] Build and publish updated transport-types package
- [ ] Update API and Web package.json to use new version

#### **Afternoon: Backend Cleanup (3-4 hours)**
- [ ] Delete `apps/api/src/agent-platform/websocket/` directory
- [ ] Remove TaskProgressGateway from AgentPlatformModule
- [ ] Remove `@nestjs/websockets` and `socket.io` from package.json
- [ ] Run `npm install` to clean dependencies
- [ ] Fix any TypeScript errors from removed imports
- [ ] **Verify task messages system still works** (CRITICAL - DO NOT REMOVE)
  - [ ] Confirm `TaskMessageService` is intact
  - [ ] Confirm `task_messages` table is intact
  - [ ] Confirm webhook endpoints still work
  - [ ] Confirm polling endpoint `GET /tasks/:id/messages` still works
- [ ] Verify API builds successfully

### Day 2: Backend SSE Implementation

#### **Morning: A2A Controller SSE Endpoint (3-4 hours)**
- [ ] Add `streamAgentTask()` endpoint to Agent2AgentController
- [ ] Implement `formatSSEEvent()` helper for type conversion
- [ ] Add SSE endpoint URL to task response metadata
- [ ] **Implement three-tier storage:** in-memory → short-term DB → long-term tasks
- [ ] Add `expires_at` column to `task_messages` table
- [ ] Update `TaskMessageService` to set TTL on message creation
- [ ] Add keep-alive ping mechanism
- [ ] Add cleanup on client disconnect
- [ ] Test SSE endpoint with curl/Postman

#### **Afternoon: Integration Testing & Cleanup Job (2-3 hours)**
- [ ] **Add cron job to clean up expired messages** (every 15 minutes)
- [ ] Test SSE with real agent execution
- [ ] Test high-frequency updates (every 5 seconds)
- [ ] Test with long-running tasks (1+ minute)
- [ ] **Test polling endpoint gets recent updates** (`GET /tasks/:id/messages`)
- [ ] **Test webhook → in-memory → DB → SSE/polling flow**
- [ ] **Test messages expire after 1 hour**
- [ ] Test SSE reconnection gets missed messages from DB
- [ ] Test reconnection scenarios
- [ ] Test multiple concurrent streams
- [ ] Add integration tests for SSE streaming
- [ ] Document SSE endpoint in API docs

### Day 3: Frontend Implementation

#### **Morning: SSE Client Service (3-4 hours)**
- [ ] Remove WebSocket code from agent chat store
- [ ] Remove `socket.io-client` from package.json
- [ ] Create `apps/web/src/services/agent2agent/sse/sseClient.ts`
- [ ] Implement SSEClient class with EventSource
- [ ] Add reconnection logic with exponential backoff
- [ ] Add typed event handlers using transport-types

#### **Afternoon: Store Integration (3-4 hours)**
- [ ] Replace WebSocket state with SSE client in store
- [ ] Implement `initializeSSE()` action
- [ ] Implement `subscribeToStream()` action
- [ ] Update stream event handlers to use SSE types
- [ ] Add cleanup logic
- [ ] Test in development environment

### Day 4: Testing & Polish

#### **Morning: End-to-End Testing (3 hours)**
- [ ] Test complete flow: task creation → SSE stream → completion
- [ ] Test real-time progress updates every 5 seconds
- [ ] Test tasks taking 1+ minute with frequent updates
- [ ] **Test dual access: SSE for real-time, polling for history**
- [ ] **Test external webhook → stored messages → available via SSE + polling**
- [ ] Test error scenarios and error events
- [ ] Test reconnection after network interruption (updates resume)
- [ ] Test with long-running streams (5+ minutes)
- [ ] Test with multiple concurrent conversations streaming simultaneously
- [ ] **Test client switches from SSE to polling mid-stream**

#### **Afternoon: Performance & Documentation (3 hours)**
- [ ] Test with realistic message volumes
- [ ] Check for memory leaks in long-running connections
- [ ] Update frontend documentation
- [ ] Update API documentation
- [ ] Create troubleshooting guide
- [ ] Document SSE event types and usage

## Success Metrics

### Protocol Compliance Metrics
- [ ] **100% A2A SSE compliance** - Follows A2A specification exactly
- [ ] **SSE endpoint functional** - `GET /agent-to-agent/:org/:agent/tasks/:id/stream` works
- [ ] **Strongly typed events** - All SSE events use transport-types
- [ ] **Browser compatibility** - Works in Chrome, Firefox, Safari, Edge
- [ ] **External client compatibility** - Works with A2A-compliant tools

### Feature Preservation Metrics
- [ ] **100% streaming feature parity** - All previous streaming features work with SSE
- [ ] **0% functionality regression** - No loss of existing capabilities
- [ ] **Cleaner codebase** - Removed WebSocket complexity entirely
- [ ] **Type safety maintained** - Strong TypeScript typing throughout

### Performance Metrics
- [ ] **Latency comparable** - SSE latency within 10% of WebSocket
- [ ] **Reconnection reliability** - Automatic reconnection success rate >95%
- [ ] **Concurrent connections** - Support 1000+ concurrent SSE streams
- [ ] **Memory efficiency** - No memory leaks in long-running connections

### Business Impact Metrics
- [ ] **Fast implementation** - Complete in 3-4 days, not 4 weeks
- [ ] **Developer satisfaction** - Simpler SSE API than WebSocket
- [ ] **Ecosystem integration** - Successfully tested with external A2A clients
- [ ] **Reduced complexity** - ~1000+ fewer lines of code, single protocol

## Risk Assessment & Mitigation

### High Priority Risks

#### **Risk: Browser EventSource Limitations**
**Probability:** Medium | **Impact:** High  
**Issue:** EventSource doesn't support custom headers (auth must be in URL or cookies)  
**Mitigation:**
- Use query parameter for auth token (temporary, secure over HTTPS)
- Implement cookie-based auth as alternative
- Consider creating proxy endpoint that adds headers server-side

#### **Risk: SSE Connection Limits**
**Probability:** Low | **Impact:** Medium  
**Issue:** Browsers limit SSE connections per domain (typically 6)  
**Mitigation:**
- Close SSE connections when not actively streaming
- Use single SSE connection with multiplexing if needed
- Document connection management best practices

### Medium Priority Risks

#### **Risk: Reconnection Loop**
**Probability:** Medium | **Impact:** Medium  
**Issue:** Failed SSE connections might retry infinitely  
**Mitigation:**
- Implement exponential backoff
- Set maximum reconnection attempts (5)
- Emit error events for monitoring

#### **Risk: Breaking Active Connections**
**Probability:** High | **Impact:** Low  
**Issue:** Active WebSocket connections will break when we deploy  
**Mitigation:**
- Deploy during low-traffic hours
- Add announcement banner before deployment
- Users will simply refresh/reconnect automatically
- Short-term disruption acceptable for long-term simplicity

## Appendix

### A: SSE vs WebSocket Comparison

| Feature | SSE | WebSocket | Winner |
|---------|-----|-----------|--------|
| **Protocol** | HTTP/1.1 or HTTP/2 | WebSocket protocol | SSE (simpler) |
| **Direction** | Server → Client only | Bidirectional | SSE (for streaming) |
| **Browser API** | EventSource (native) | WebSocket (native) | Tie |
| **Reconnection** | Automatic | Manual | SSE |
| **Message Format** | Text (typically JSON) | Text or Binary | Tie |
| **A2A Compliance** | Required | Not specified | SSE |
| **Connection Limit** | Yes (6 per domain) | No limit | WebSocket |
| **Firewall Friendly** | Yes (HTTP) | Sometimes blocked | SSE |

### B: EventSource API Reference

```typescript
// Browser EventSource API (standard)
const eventSource = new EventSource('/stream?token=abc123');

eventSource.onopen = () => console.log('Connected');
eventSource.onerror = (error) => console.error('Error:', error);

// Listen to custom events
eventSource.addEventListener('agent_stream_chunk', (event) => {
  const data = JSON.parse(event.data);
  console.log('Chunk:', data);
});

// Close connection
eventSource.close();
```

### C: SSE Message Format (A2A Compliant)

**Example: Frequent Progress Updates for Long-Running Task**

```
event: agent_stream_chunk
data: {"streamId":"abc-123","chunk":{"type":"partial","content":"Starting analysis...","metadata":{"progress":10,"step":"initialization"}},...}
id: msg-001

event: agent_stream_chunk
data: {"streamId":"abc-123","chunk":{"type":"partial","content":"Processing data...","metadata":{"progress":25,"step":"data_processing"}},...}
id: msg-002

event: agent_stream_chunk
data: {"streamId":"abc-123","chunk":{"type":"partial","content":"Generating report...","metadata":{"progress":60,"step":"report_generation"}},...}
id: msg-003

event: agent_stream_chunk
data: {"streamId":"abc-123","chunk":{"type":"partial","content":"Finalizing...","metadata":{"progress":90,"step":"finalization"}},...}
id: msg-004

event: agent_stream_chunk
data: {"streamId":"abc-123","chunk":{"type":"final","content":"Complete! Generated 45-page report.","metadata":{"progress":100}},...}
id: msg-005

event: agent_stream_complete
data: {"streamId":"abc-123","type":"complete",...}
id: msg-006
```

**Timing:** Events sent every ~5 seconds (or more frequently) as task progresses.

### D: Testing Checklist

- [ ] SSE endpoint returns correct headers
- [ ] SSE events are properly formatted
- [ ] Frontend SSEClient connects and receives events
- [ ] Reconnection works after network interruption
- [ ] Multiple concurrent streams work correctly
- [ ] Keep-alive pings maintain connection
- [ ] Client disconnect cleans up server resources
- [ ] Auth token validation works
- [ ] Error events are handled gracefully
- [ ] Complete events close connection properly

## Conclusion

This PRD outlines a **radical simplification** to achieve A2A SSE protocol compliance by completely replacing WebSocket with SSE. This is not a migration - it's a clean replacement.

### What We're Doing:
1. ❌ **Delete WebSocket** - Remove TaskProgressGateway, Socket.IO dependencies, all WebSocket code
2. ✅ **Implement SSE** - Add SSE endpoint to Agent2AgentController, create SSE client
3. ✅ **Strong Typing** - All SSE events defined in transport-types package
4. ✅ **3-4 Day Timeline** - Complete implementation, not weeks of migration

### Why This Approach:
- **No Technical Debt** - Single protocol, no dual support complexity
- **A2A Compliant** - Follows official specification exactly
- **Simpler Code** - ~1000+ fewer lines of code
- **Faster Development** - Days instead of weeks
- **Cleaner Architecture** - One way to do streaming, not two

**Key Success Factors:**
1. **Types First** - Define SSE events in transport-types before implementation
2. **Clean Removal** - Delete all WebSocket code, no half-measures
3. **Test Thoroughly** - Comprehensive testing across browsers and use cases
4. **Accept Disruption** - 1-2 days of active development worth the simplicity

The implementation plan provides a structured **4-day development cycle**. Success will be measured by A2A compliance, code simplicity, and type safety.

---

**Next Steps:**
1. Review and approve PRD
2. Create transport-types SSE event definitions
3. Begin backend SSE endpoint implementation
4. Schedule weekly progress reviews


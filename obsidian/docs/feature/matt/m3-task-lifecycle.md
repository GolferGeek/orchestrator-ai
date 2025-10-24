# M3.1 — Task Lifecycle Events

We emit standardized lifecycle events for A2A agent executions to provide consistent progress/complete/fail signals without introducing new endpoints.

## Events
- `agent.lifecycle.start` — execution has started
- `agent.lifecycle.progress` — optional progress updates
- `agent.lifecycle.complete` — execution completed successfully
- `agent.lifecycle.fail` — execution failed

## Payload (common fields)
```
{
  conversationId?: string,
  sessionId?: string,
  organizationSlug: string | null,
  agentSlug: string,
  mode: 'converse' | 'plan' | 'build' | ...,
  timestamp: string,
  // one of the following, depending on event
  metadata?: object,
  progress?: { step?: string, message?: string, percent?: number, metadata?: object },
  result?: any,
  error?: { reason: string }
}
```

## Where emitted
- In `AgentModeRouterService` around non-stream executions (also emitted for stream executions once final result is ready).
- Built on `AgentRuntimeLifecycleService` which uses the Nest EventEmitter.

## Why events (not endpoints)
- Preserves strict A2A surface (card, tasks, health)
- Allows ops/UX consumers to subscribe to runtime signals via the existing event bus/WebSocket infra

## Next
- Add granular progress calls (e.g., prompt build, dispatch, extract) where useful
- Optionally correlate with streaming `agent.stream.*` events for richer UI updates

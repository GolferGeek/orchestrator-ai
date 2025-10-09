# n8n Webhook Status Integration Guide

This guide explains how to integrate n8n workflows with our WebSocket system for real-time status updates and A2A protocol compliance.

## Overview

Our n8n workflows can emit real-time status updates through webhooks, which our API captures and broadcasts via WebSocket to the frontend. This enables live progress tracking for long-running agentic processes without requiring database storage.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   n8n       │    │     Our      │    │  WebSocket  │    │   Frontend   │
│  Workflow   │───▶│     API      │───▶│   System    │───▶│     UI       │
│             │    │              │    │             │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
     │                      │
     │                      ▼
     │              ┌──────────────┐
     │              │   Status     │
     └─────────────▶│   Storage    │ (In-memory, no DB)
                    │   (taskId)   │
                    └──────────────┘
```

## Status Update Pattern

### Standard Progress Payload

Every status update from n8n follows this structure:

```typescript
interface WorkflowProgress {
  executionId: string;        // n8n execution ID
  taskId: string;            // Your A2A task ID
  stage: string;             // Current processing stage
  percent: number;           // Progress percentage (0-100)
  message: string;           // Human-readable status
  node: string;              // Current n8n node name
  timestamp: string;         // ISO timestamp
  meta?: {                   // Optional metadata
    runIndex?: number;
    estimatedTimeRemaining?: number;
    partialResults?: any;
  }
}
```

### Workflow Implementation Pattern

Each n8n workflow should emit status at key milestones:

1. **Start**: `{ stage: "started", percent: 1, message: "Task accepted" }`
2. **Input Processing**: `{ stage: "processing_input", percent: 10, message: "Validating input" }`
3. **Core Work**: `{ stage: "generating_content", percent: 50, message: "Generating marketing content" }`
4. **Completion**: `{ stage: "completed", percent: 100, message: "All content generated" }`

## n8n Implementation

### Reusable Progress Emitter Sub-workflow

Create a reusable "Emit Progress" sub-workflow that can be called from any main workflow:

**Sub-workflow Name**: `Emit Progress`

**Parameters**:
- `stage` (string): Current processing stage
- `percent` (number): Progress percentage  
- `message` (string): Human-readable message
- `taskId` (string): Your A2A task ID

**Nodes**:

1. **Set Node** - Build progress payload:
```json
{
  "executionId": "{{ $execution.id }}",
  "taskId": "{{ $parameter.taskId }}",
  "stage": "{{ $parameter.stage }}",
  "percent": {{ $parameter.percent }},
  "message": "{{ $parameter.message }}",
  "node": "{{ $node.name }}",
  "timestamp": "{{ $now }}",
  "meta": {
    "runIndex": "{{ $runIndex }}"
  }
}
```

2. **HTTP Request Node** - Send to your API:
- **URL**: `https://your-api.com/api/workflow/progress`
- **Method**: POST
- **Headers**: `Authorization: Bearer {{ $parameter.apiKey }}`
- **Body**: `{{ $json }}`
- **Options**: 
  - Continue on Fail: `true`
  - Retry on Fail: `3`
  - Timeout: `10000ms`

### Main Workflow Pattern

In your main workflows, call the progress emitter at key points:

```
Webhook Trigger (Response: Immediately)
    ↓
Execute Workflow: "Emit Progress" 
    stage="started", percent=1, message="Processing request"
    ↓
[Your actual work nodes]
    ↓
Execute Workflow: "Emit Progress"
    stage="generating", percent=50, message="Creating marketing content"
    ↓
[More work nodes]
    ↓
Execute Workflow: "Emit Progress" 
    stage="completed", percent=100, message="All content ready"
```

## API Integration (TypeScript)

### Webhook Endpoint

Create an endpoint to receive status updates from n8n:

```typescript
// POST /api/workflow/progress
export async function handleWorkflowProgress(req: Request, res: Response) {
  const progress: WorkflowProgress = req.body;
  
  // Validate the payload
  if (!progress.executionId || !progress.taskId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Store in memory for polling (no database needed)
  statusStore.set(progress.taskId, progress);
  
  // Broadcast via WebSocket
  webSocketService.emit(`task:${progress.taskId}`, 'progress', progress);
  
  // Also emit to execution-specific channel
  webSocketService.emit(`execution:${progress.executionId}`, 'progress', progress);
  
  res.status(204).send();
}
```

### Polling Endpoint (A2A Compliance)

Support polling for A2A protocol compliance:

```typescript
// GET /api/workflow/status/:taskId
export async function getWorkflowStatus(req: Request, res: Response) {
  const { taskId } = req.params;
  
  const status = statusStore.get(taskId);
  
  if (!status) {
    return res.status(404).json({ 
      error: 'Task not found',
      taskId 
    });
  }
  
  res.json({
    taskId,
    status: status.stage,
    progress: status.percent,
    message: status.message,
    lastUpdate: status.timestamp,
    isComplete: status.percent >= 100
  });
}
```

### In-Memory Status Store

Simple in-memory storage for status tracking:

```typescript
interface StatusEntry {
  progress: WorkflowProgress;
  lastUpdate: Date;
}

class WorkflowStatusStore {
  private store = new Map<string, StatusEntry>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  set(taskId: string, progress: WorkflowProgress) {
    this.store.set(taskId, {
      progress,
      lastUpdate: new Date()
    });
    
    // Clean up old entries
    this.cleanup();
  }
  
  get(taskId: string): WorkflowProgress | null {
    const entry = this.store.get(taskId);
    if (!entry || Date.now() - entry.lastUpdate.getTime() > this.TTL) {
      this.store.delete(taskId);
      return null;
    }
    return entry.progress;
  }
  
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.lastUpdate.getTime() > this.TTL) {
        this.store.delete(key);
      }
    }
  }
}

export const statusStore = new WorkflowStatusStore();
```

## Workflow Trigger Pattern

### Starting a Workflow

When triggering an n8n workflow from your API:

```typescript
export async function startMarketingWorkflow(req: Request, res: Response) {
  const { announcement, product, target_audience, tone } = req.body;
  const taskId = generateTaskId(); // Your A2A task ID
  
  // Trigger n8n workflow
  const n8nResponse = await fetch('http://localhost:5678/webhook/marketing-swarm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      announcement,
      product,
      target_audience,
      tone,
      callback_url: `${process.env.API_BASE_URL}/api/workflow/progress`
    })
  });
  
  const { executionId } = await n8nResponse.json();
  
  // Store initial status
  statusStore.set(taskId, {
    executionId,
    taskId,
    stage: 'queued',
    percent: 0,
    message: 'Workflow queued',
    node: 'webhook',
    timestamp: new Date().toISOString()
  });
  
  // Immediate response (A2A compliant)
  res.json({
    taskId,
    executionId,
    status: 'started',
    pollUrl: `/api/workflow/status/${taskId}`,
    websocketChannel: `task:${taskId}`
  });
}
```

## Frontend Integration

### WebSocket Subscription

```typescript
// Subscribe to task progress
socket.on(`task:${taskId}`, (event: string, progress: WorkflowProgress) => {
  if (event === 'progress') {
    updateProgressBar(progress.percent);
    updateStatusMessage(progress.message);
    updateCurrentStage(progress.stage);
    
    if (progress.percent >= 100) {
      handleWorkflowComplete(progress);
    }
  }
});
```

### Polling Fallback

```typescript
// Polling fallback for A2A compliance
async function pollWorkflowStatus(taskId: string) {
  const response = await fetch(`/api/workflow/status/${taskId}`);
  
  if (response.ok) {
    const status = await response.json();
    updateUI(status);
    
    if (!status.isComplete) {
      setTimeout(() => pollWorkflowStatus(taskId), 2000);
    }
  }
}
```

## Security Considerations

### Webhook Authentication

Add authentication to your progress webhook:

```typescript
// Verify requests from n8n
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

export function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers['x-n8n-signature'];
  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
    
  return signature === expectedSignature;
}
```

### Rate Limiting

Protect against webhook spam:

```typescript
import rateLimit from 'express-rate-limit';

const progressRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 progress updates per minute per IP
  message: 'Too many progress updates'
});

app.use('/api/workflow/progress', progressRateLimit);
```

## Testing & Debugging

### Test Progress Updates

```bash
# Test the progress webhook directly
curl -X POST http://localhost:9000/api/workflow/progress \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "executionId": "test-123",
    "taskId": "task-456", 
    "stage": "testing",
    "percent": 50,
    "message": "Test progress update",
    "node": "test-node",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }'
```

### Monitor Status Store

```typescript
// Debug endpoint to see current status store
app.get('/api/workflow/debug/status-store', (req, res) => {
  const allStatuses = Array.from(statusStore.entries());
  res.json(allStatuses);
});
```

## Benefits of This Approach

### ✅ **No Database Required**
- Status stored in memory with TTL
- Automatic cleanup of old entries
- Fast polling responses

### ✅ **Real-time Updates**
- WebSocket broadcasts for live UI updates
- Immediate feedback on progress
- No polling delay for connected clients

### ✅ **A2A Protocol Compliant**
- Polling endpoint for disconnected clients
- Standard HTTP status responses
- Task correlation via taskId

### ✅ **Scalable Pattern**
- Reusable progress emitter sub-workflow
- Consistent payload structure
- Easy to add to any n8n workflow

### ✅ **Robust Error Handling**
- Continue on webhook failures
- Retry logic for status updates
- Graceful degradation

This pattern lets you replace your LangGraph flows with n8n while maintaining the same real-time progress experience for your users!

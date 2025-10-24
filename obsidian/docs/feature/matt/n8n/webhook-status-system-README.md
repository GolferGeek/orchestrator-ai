# n8n Webhook Status System - Complete Guide

This README explains how to use n8n as a replacement for LangGraph with real-time WebSocket status updates for agentic processes.

## Architecture Overview

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Client    │    │     Your     │    │  WebSocket  │    │   Frontend   │
│   Request   │───▶│     API      │───▶│   System    │───▶│     UI       │
│             │    │              │    │             │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │                    ▲
                           ▼                    │
                   ┌──────────────┐    ┌─────────────┐
                   │     n8n      │───▶│   Status    │
                   │   Workflow   │    │   Updates   │
                   │              │    │ (In-memory) │
                   └──────────────┘    └─────────────┘
```

## Key Benefits

### ✅ **Replaces LangGraph with n8n**
- Visual workflow builder instead of code
- Better debugging and monitoring
- Team collaboration on workflows
- Version control via our migration system

### ✅ **Real-time Status Updates**
- Live progress via WebSocket
- No database required for status
- A2A protocol compliant polling
- Immediate user feedback

### ✅ **Production Ready**
- Robust error handling
- Retry logic for status updates
- Graceful degradation
- Security via API keys

## Workflow Pattern

### Standard Status Emission Pattern

Every n8n workflow follows this pattern:

```
Webhook Trigger (Immediate Response)
    ↓
Emit Progress: "started" (1%)
    ↓
[Main Work: Generate Web Post]
    ↓
Emit Progress: "web_post_generated" (25%)
    ↓
[Main Work: Generate SEO Content]
    ↓
Emit Progress: "seo_content_generated" (50%)
    ↓
[Main Work: Generate Social Content]
    ↓
Emit Progress: "social_content_generated" (75%)
    ↓
Combine Final Output
    ↓
Emit Progress: "completed" (100%) + Results
```

### Status Update Structure

Each status update follows this TypeScript interface:

```typescript
interface WorkflowProgress {
  executionId: string;        // n8n execution ID
  taskId: string;            // Your A2A task ID
  stage: string;             // Current processing stage
  percent: number;           // Progress percentage (0-100)
  message: string;           // Human-readable status
  node: string;              // Current n8n node name
  timestamp: string;         // ISO timestamp
  results?: any;             // Final results (only on completion)
}
```

## API Integration (TypeScript)

### 1. Starting a Workflow

```typescript
export async function startMarketingWorkflow(req: Request, res: Response) {
  const { announcement, product, target_audience, tone } = req.body;
  const taskId = generateTaskId(); // Your A2A task ID
  
  // Trigger n8n workflow
  const response = await fetch('http://localhost:5678/webhook/marketing-swarm', {
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
  
  const result = await response.json();
  
  // Store initial status in memory
  workflowStatusStore.set(taskId, {
    executionId: result.executionId,
    taskId,
    stage: 'queued',
    percent: 0,
    message: 'Workflow queued',
    node: 'webhook',
    timestamp: new Date().toISOString()
  });
  
  // Immediate A2A compliant response
  res.json({
    taskId,
    executionId: result.executionId,
    status: 'started',
    pollUrl: `/api/workflow/status/${taskId}`,
    websocketChannel: `task:${taskId}`
  });
}
```

### 2. Receiving Status Updates

```typescript
// POST /api/workflow/progress
export async function handleWorkflowProgress(req: Request, res: Response) {
  const progress: WorkflowProgress = req.body;
  
  // Validate required fields
  if (!progress.executionId || !progress.taskId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Store in memory for polling (no database needed)
  workflowStatusStore.set(progress.taskId, progress);
  
  // Broadcast via WebSocket to connected clients
  webSocketService.emit(`task:${progress.taskId}`, 'progress', progress);
  
  // Also emit to execution-specific channel
  webSocketService.emit(`execution:${progress.executionId}`, 'progress', progress);
  
  // Log for debugging
  console.log(`[${progress.taskId}] ${progress.stage}: ${progress.percent}% - ${progress.message}`);
  
  res.status(204).send();
}
```

### 3. Polling Support (A2A Compliance)

```typescript
// GET /api/workflow/status/:taskId
export async function getWorkflowStatus(req: Request, res: Response) {
  const { taskId } = req.params;
  
  const status = workflowStatusStore.get(taskId);
  
  if (!status) {
    return res.status(404).json({ 
      error: 'Task not found or expired',
      taskId 
    });
  }
  
  res.json({
    taskId,
    executionId: status.executionId,
    status: status.stage,
    progress: status.percent,
    message: status.message,
    lastUpdate: status.timestamp,
    isComplete: status.percent >= 100,
    results: status.results || null
  });
}
```

### 4. In-Memory Status Store

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
    
    // Auto-cleanup old entries
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
  
  // Get all active tasks (for debugging)
  getAll(): WorkflowProgress[] {
    this.cleanup();
    return Array.from(this.store.values()).map(entry => entry.progress);
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

export const workflowStatusStore = new WorkflowStatusStore();
```

## Frontend Integration

### WebSocket Subscription

```typescript
// Subscribe to task progress
socket.on(`task:${taskId}`, (event: string, progress: WorkflowProgress) => {
  if (event === 'progress') {
    // Update progress bar
    updateProgressBar(progress.percent);
    
    // Update status message
    updateStatusMessage(progress.message);
    
    // Update current stage indicator
    updateCurrentStage(progress.stage);
    
    // Handle completion
    if (progress.percent >= 100) {
      handleWorkflowComplete(progress.results);
    }
  }
});
```

### Polling Fallback

```typescript
// Polling fallback for A2A compliance or reconnection
async function pollWorkflowStatus(taskId: string): Promise<void> {
  try {
    const response = await fetch(`/api/workflow/status/${taskId}`);
    
    if (response.ok) {
      const status = await response.json();
      updateUI(status);
      
      if (!status.isComplete) {
        setTimeout(() => pollWorkflowStatus(taskId), 2000);
      }
    } else if (response.status === 404) {
      console.log('Task not found or expired');
    }
  } catch (error) {
    console.error('Polling error:', error);
    setTimeout(() => pollWorkflowStatus(taskId), 5000); // Retry with longer delay
  }
}
```

## Example: Marketing Swarm Workflow

### Input Structure

```typescript
interface MarketingSwarmInput {
  taskId: string;                    // Your A2A task ID
  announcement: string;              // "We're launching AI-powered automation"
  product: string;                   // "OrchestratorAI"
  target_audience: string;           // "developers"
  tone: string;                      // "professional"
  callback_url: string;              // "https://your-api.com/api/workflow/progress"
}
```

### Output Structure

```typescript
interface MarketingSwarmOutput {
  web_post: {
    headline: string;
    body: string;
    cta: string;
    benefits: string[];
  };
  seo_content: {
    primary_keyword: string;
    secondary_keywords: string[];
    meta_title: string;
    meta_description: string;
    h1: string;
    h2_tags: string[];
    faq: Array<{question: string, answer: string}>;
  };
  social_media: {
    twitter: string;
    linkedin: string;
    facebook: string;
    instagram: string;
    youtube: string;
  };
}
```

### Status Progression

1. **started** (1%): "Marketing swarm workflow initiated"
2. **web_post_generated** (25%): "Web post content generated"
3. **seo_content_generated** (50%): "SEO content and keywords generated"
4. **social_content_generated** (75%): "Social media content generated"
5. **completed** (100%): "All marketing content generated successfully" + results

### Webhook URL

The workflow is accessible at: `http://localhost:5678/webhook/marketing-swarm`

For production: `https://your-domain.com/webhook/marketing-swarm`

## Testing the Workflow

### 1. Test with curl

```bash
curl -X POST http://localhost:5678/webhook/marketing-swarm \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "announcement": "We are launching revolutionary AI workflow automation",
    "product": "OrchestratorAI",
    "target_audience": "developers and business leaders",
    "tone": "professional but exciting",
    "callback_url": "https://your-api.com/api/workflow/progress"
  }'
```

### 2. Expected Response

```json
{
  "executionId": "abc123-def456",
  "taskId": "test-123", 
  "status": "started"
}
```

### 3. Status Updates You'll Receive

Your API will receive POST requests to `/api/workflow/progress` with:

```json
{
  "executionId": "abc123-def456",
  "taskId": "test-123",
  "stage": "web_post_generated",
  "percent": 25,
  "message": "Web post content generated",
  "node": "Emit Web Post Complete",
  "timestamp": "2025-10-07T16:15:30.123Z"
}
```

## Deployment to Production

### 1. Activate the Workflow

In n8n UI (http://localhost:5678):
- Open "Marketing Swarm - Major Announcement"
- Click "Active" toggle
- Save

### 2. Create Migration

```bash
npm run n8n:create-migration "Marketing Swarm - Major Announcement"
```

### 3. Deploy to Team

```bash
git add apps/api/supabase/migrations/
git commit -m "feat: add marketing swarm workflow with webhook status updates"
git push
```

### 4. Team Gets Workflow

When team members run:
```bash
git pull
npm run dev:api  # Auto-applies migrations
```

They automatically get the workflow in their local n8n instance.

## Advanced Patterns

### Error Handling

Each HTTP Request node is configured with:
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Continue on Fail**: true (workflow doesn't stop if status update fails)

### Custom Stages

You can add custom stages by:
1. Adding new "Emit Progress" + "Send Status" node pairs
2. Using descriptive stage names like:
   - `"validating_input"`
   - `"calling_external_api"`
   - `"processing_results"`
   - `"finalizing_output"`

### Parallel Processing

For parallel work (multiple AI calls), emit status for each branch:
- `"branch_a_complete"` (30%)
- `"branch_b_complete"` (60%)
- `"all_branches_complete"` (90%)

## Security & Performance

### Authentication

Add authentication to your progress webhook:

```typescript
// Verify requests from n8n
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

function verifyWebhookAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  return authHeader === `Bearer ${WEBHOOK_SECRET}`;
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const progressRateLimit = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 100,                // Max 100 updates per minute
  message: 'Too many progress updates'
});
```

### Performance Monitoring

```typescript
// Track workflow performance
interface WorkflowMetrics {
  totalDuration: number;
  stageTimings: Record<string, number>;
  nodeExecutionTimes: Record<string, number>;
}

// Log metrics on completion
function logWorkflowMetrics(progress: WorkflowProgress) {
  if (progress.percent >= 100) {
    console.log(`Workflow ${progress.taskId} completed in ${totalTime}ms`);
  }
}
```

## Troubleshooting

### Status Updates Not Received

1. **Check n8n logs**: `npm run n8n:logs`
2. **Verify callback URL**: Ensure it's reachable from n8n
3. **Check API authentication**: Verify webhook endpoint auth
4. **Test manually**: Use curl to test progress endpoint

### Workflow Not Starting

1. **Check webhook URL**: `http://localhost:5678/webhook/marketing-swarm`
2. **Verify workflow is active**: Check n8n UI
3. **Check input format**: Ensure JSON matches expected structure
4. **Review n8n execution logs**: Look for errors in n8n UI

### WebSocket Issues

1. **Check connection**: Verify WebSocket server is running
2. **Verify channels**: Ensure correct channel names (`task:${taskId}`)
3. **Check authentication**: WebSocket auth if required
4. **Fallback to polling**: Use GET `/api/workflow/status/${taskId}`

## Migration from LangGraph

### Before (LangGraph)
```python
# Manual WebSocket calls in code
await websocket.emit(f"task:{task_id}", {
  "stage": "processing",
  "percent": 50
})
```

### After (n8n)
```
[Set Node] → [HTTP Request Node] → Your API → WebSocket
```

**Benefits:**
- ✅ **Visual**: See the status emission points in n8n UI
- ✅ **Reusable**: Copy status emission patterns between workflows
- ✅ **Debuggable**: See exactly where status updates happen
- ✅ **Team Friendly**: Non-developers can understand and modify workflows

## Next Steps

1. **Test the Marketing Swarm workflow** with a real request
2. **Create more workflows** using the same status pattern
3. **Build reusable sub-workflows** for common status emission patterns
4. **Add error handling workflows** for failed status updates
5. **Monitor and optimize** based on real usage patterns

This system gives you the power of LangGraph with the visual clarity and team collaboration of n8n! 🚀

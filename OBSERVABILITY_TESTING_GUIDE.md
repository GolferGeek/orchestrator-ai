# 🧪 Observability System Testing Guide

## Quick Start (3 Steps)

### Step 1: Start the Servers

Open **two separate terminals**:

**Terminal 1 - API Server:**
```bash
cd ~/projects/golfergeek/orchestrator-ai
npm run dev:api
```
Wait for: `✅ Development environment ready!`  
API will be at: `http://localhost:7100`

**Terminal 2 - Web Client:**
```bash
cd ~/projects/golfergeek/orchestrator-ai
npm run dev:web
```
Wait for: `Local: http://localhost:7101/` (or check terminal for actual port)
Web UI will be at: `http://localhost:7101` (default from WEB_PORT in .env)

### Step 2: Access the Observability UI

1. Open browser: `http://localhost:7101` (or the port shown in your terminal)
2. Login with admin credentials:
   - **Email:** `demo.user@playground.com`
   - **Password:** `demouser`
3. Navigate to: **Admin → System Observability**
   - Look for the pulse icon (📊) in the left sidebar under "Admin"

> **Note:** The web port is configured via `WEB_PORT` or `VITE_WEB_PORT` in your `.env` file.  
> Default is **7101** but your terminal will show the actual port being used.

### Step 3: Test with Live Events

**Option A: Use the Test Script (Recommended)**

In a third terminal:
```bash
cd ~/projects/golfergeek/orchestrator-ai
node test-observability.js
```

This will send 3 test events:
- ✅ `agent.started` - Agent execution started
- ⏩ `agent.progress` - Calling LLM (50%)
- ✅ `agent.completed` - Agent execution completed

**Option B: Execute a Real Agent**

1. In the web UI, go to **Chat** page
2. Select any agent (e.g., "Golf Rules Coach")
3. Send a message
4. Switch to **Admin → System Observability**
5. Watch events flow in real-time! 🎉

---

## What You Should See

### Timeline Tab
- Chronological list of all events
- Search and filter capabilities
- Event cards showing:
  - Username (demo.user@playground.com)
  - Agent slug
  - Conversation ID (clickable!)
  - Progress bars for in-progress events

### Swim Lanes Tab
- One lane per active agent
- Visual timeline with event dots
- Latest event highlighted
- Status indicators (active/idle/error)

### Analytics Tab
- Total events count
- Active agents count
- Unique conversations
- Last update timestamp
- Event type breakdown

### Clicking a Conversation ID
Opens a modal showing:
- Full conversation details
- All related observability events
- Related tasks and deliverables
- Event statistics

---

## Troubleshooting

### API Server Not Starting
```bash
# Check if Supabase is running
docker ps | grep supabase

# If not, start it manually
cd apps/api
supabase start --config ./supabase/config.dev.toml
```

### Connection Status Shows "Disconnected"
1. Check console for errors (F12 → Console)
2. Verify API is running: `curl http://localhost:7100/health`
3. Check auth token in localStorage

### No Events Appearing
1. Verify webhook endpoint: `curl -X POST http://localhost:7100/webhooks/status -H "Content-Type: application/json" -d '{"taskId":"test","status":"agent.started","timestamp":"2024-01-01T00:00:00Z"}'`
2. Check browser console for SSE connection errors
3. Verify admin role: Check user profile in web UI

### Database Errors
```bash
# Check migration was applied
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "\dt public.observability_events"

# Should show the table
```

---

## Test Scenarios

### Scenario 1: Basic Event Flow
1. Send test events with `node test-observability.js`
2. Verify all 3 events appear in timeline
3. Check swim lanes show the test-agent
4. Verify analytics update

### Scenario 2: Real Agent Execution
1. Chat with any agent
2. Monitor observability UI
3. Should see:
   - `agent.started` when request begins
   - `agent.progress` events during execution
   - `agent.completed` when done

### Scenario 3: Context Agent Progress
1. Use a context-heavy agent
2. Watch for specific progress events:
   - "Fetching context"
   - "Optimizing context"
   - "Calling LLM"
   - "Saving deliverable"

### Scenario 4: API Agent Execution
1. Use an API-based agent
2. Watch for:
   - "Calling external API"
   - "Processing API response"
   - "Formatting response"

### Scenario 5: Multiple Concurrent Agents
1. Open multiple chat windows
2. Send messages to different agents simultaneously
3. Watch swim lanes show multiple active agents
4. Verify events from different agents don't interfere

### Scenario 6: Conversation Detail View
1. Click any conversation ID in the timeline
2. Modal should open showing:
   - Conversation metadata
   - Full message history
   - All related events
   - Event statistics

---

## Expected Backend Behavior

### Webhook Controller
- Accepts events at `/webhooks/status`
- Resolves username from userId
- Stores event in `public.observability_events`
- Broadcasts to admin SSE stream

### SSE Endpoint
- Admin-only: `/observability/stream`
- Broadcasts all events in real-time
- Heartbeat every 30 seconds
- Auto-reconnect on disconnect

### Database
- Table: `public.observability_events`
- Indexes on: conversation_id, task_id, user_id, agent_slug
- Stores events indefinitely

---

## Advanced Testing

### Load Testing
```bash
# Send 100 events rapidly
for i in {1..100}; do
  node test-observability.js &
done
wait
```

### Custom Event Testing
```javascript
// Create custom test events
const axios = require('axios');

async function customTest() {
  await axios.post('http://localhost:7100/webhooks/status', {
    taskId: 'custom-task',
    status: 'agent.progress',
    timestamp: new Date().toISOString(),
    userId: 'b29a590e-b07f-49df-a25b-574c956b5035',
    username: 'test-user',
    conversationId: 'custom-conv',
    agentSlug: 'custom-agent',
    mode: 'converse',
    message: 'Custom test event',
    progress: 75,
    step: 'Custom Step',
  });
}

customTest();
```

---

## Success Criteria

✅ **Backend:**
- Webhook endpoint accepts events
- Events stored in database
- SSE stream broadcasts to admin clients
- Username resolution works

✅ **Frontend:**
- SSE connection established
- Events appear in real-time
- All tabs functional (Timeline, Swim Lanes, Analytics)
- Conversation detail modal works
- Search and filtering work

✅ **Integration:**
- Real agent executions emit events
- Progress events show during execution
- Multiple agents work simultaneously
- No event loss or duplication

---

## Next Steps

Once basic testing is complete:
1. Test with production-like scenarios
2. Monitor performance with many concurrent agents
3. Verify database performance with large event counts
4. Test SSE reconnection behavior
5. Validate role-based access control

---

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review browser console for errors
3. Check API server logs
4. Verify database table exists
5. Confirm admin role is assigned


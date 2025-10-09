# Troubleshooting n8n Webhook Expressions

## Problem: taskId, conversationId, and userId are null

When the n8n workflow calls the webhook endpoint, the debug logs show:
```
Request body: {"taskId":null,"conversationId":null,"userId":null,...}
```

This means the n8n workflow isn't properly extracting data from the webhook trigger.

## Root Cause

The Set nodes in the workflow are using incorrect n8n expression syntax:

**❌ Incorrect (what we had):**
```javascript
{{ $('Webhook Trigger').item.json.taskId }}
{{ $('Webhook Trigger').item.json.conversationId }}
{{ $('Webhook Trigger').item.json.userId }}
```

This syntax doesn't work in n8n v2+ webhooks because:
1. The node name should match exactly (we had "Webhook Trigger" but the actual node is named differently)
2. The `.item.json` syntax is outdated for newer n8n versions
3. The node reference with parentheses and quotes doesn't work reliably

**✅ Correct (what we need):**
```javascript
{{ $input.first().json.taskId }}
{{ $input.first().json.conversationId }}
{{ $input.first().json.userId }}
```

This works because:
- `$input.first()` gets the first input item from the previous node
- `.json` accesses the JSON data
- No need to reference specific node names

## How to Fix in n8n UI

### Step 1: Open the Workflow
1. Go to http://localhost:5678
2. Open "Marketing Swarm - Major Announcement" workflow

### Step 2: Fix Each "Status" Set Node

You need to fix these nodes:
- ✏️ Status: Started
- ✏️ Status: Web Post Done
- ✏️ Status: SEO Done
- ✏️ Status: Social Done
- ✏️ Final Output

### Step 3: Update Expression for Each Node

For **Status: Started** node:

1. Click on the "Status: Started" Set node
2. Find the "taskId" field in the assignments list
3. Click on the value field
4. Change from: `={{ $('Webhook Trigger').item.json.taskId }}`
5. Change to: `={{ $input.first().json.taskId }}`
6. Find "conversationId" field
7. Change to: `={{ $input.first().json.conversationId }}`
8. Find "userId" field
9. Change to: `={{ $input.first().json.userId }}`
10. Click "Test step" or "Execute node" to verify

Repeat for all other Status nodes.

### Step 4: Special Case - Final Output

The "Final Output" node only needs the taskId fixed (it doesn't need conversationId/userId):

1. Click "Final Output" node
2. Find "taskId" field
3. Change to: `={{ $input.first().json.taskId }}`

### Step 5: Save and Activate

1. Click the **Save** button (top right)
2. Make sure workflow is **Active** (toggle should be green)

## Testing the Fix

### Test 1: Direct Webhook Call
```bash
./test-marketing-swarm-curl.sh
```

Check your API terminal. You should now see:
```
Request body: {"taskId":"test-task-1759861627","conversationId":"test-conv-1759861627","userId":"test-user-1759861627",...}
```

Instead of all nulls!

### Test 2: Via Postman

**Method:** POST
**URL:** `http://localhost:5678/webhook/marketing-swarm`
**Body:**
```json
{
  "taskId": "postman-test-123",
  "conversationId": "postman-conv-123",
  "userId": "postman-user-123",
  "callback_url": "http://host.docker.internal:7100/webhooks/status",
  "announcement": "Testing webhook expressions",
  "product": "OrchestratorAI",
  "target_audience": "developers",
  "tone": "professional"
}
```

Watch your API terminal for webhook hits with the correct IDs.

### Test 3: Full API Integration
```bash
./test-marketing-swarm-api.sh
```

This tests the complete flow: API → Agent → n8n → Webhook → WebSocket

## Common n8n Expression Patterns

### Getting Data from Previous Node
```javascript
// From immediate previous node
{{ $json.fieldName }}

// First item from input
{{ $input.first().json.fieldName }}

// All items from input
{{ $input.all() }}

// From specific node by exact name
{{ $node["Node Name"].json.fieldName }}
```

### Special n8n Variables
```javascript
{{ $execution.id }}          // Current execution ID
{{ $now }}                   // Current timestamp
{{ $now.toISO() }}          // ISO format timestamp
{{ $workflow.id }}          // Workflow ID
{{ $workflow.name }}        // Workflow name
{{ $node.name }}            // Current node name
```

### Testing Expressions in n8n

1. Click on any node
2. Click "Add expression"
3. Type your expression
4. Click "Test step" to see the result
5. Check if the value is populated correctly

## Why Use $input.first() Instead of Node References?

### ❌ Node References (`$('Node Name')`)
- **Brittle**: Breaks if you rename the node
- **Version-specific**: Syntax changed between n8n versions
- **Complex**: Requires exact node name matching
- **Debugging**: Hard to troubleshoot

### ✅ Input References (`$input.first()`)
- **Flexible**: Works regardless of node names
- **Stable**: Works across n8n versions
- **Simple**: Easy to understand and maintain
- **Debugging**: Clear data flow

## Workflow Data Flow

```
Webhook Trigger (receives POST data)
    ↓ (data flows via connection)
Status: Started (reads $input.first().json)
    ↓ (forwards data)
Send Status: Started (HTTP request with $json)
    ↓ (parallel branches)
Generate Web Post / SEO / Social
    ↓ (each generates content)
Status: XXX Done (reads $input.first().json for IDs)
    ↓ (sends status update)
Send Status: XXX
    ↓ (all merge)
Combine Results
    ↓
Final Output
    ↓
Send Status: Complete
```

## Debugging Checklist

When webhook data is null:

- [ ] Check node name matches exactly in expression
- [ ] Verify expression syntax is correct
- [ ] Use `$input.first().json` instead of node references
- [ ] Test node execution in n8n UI (click "Test step")
- [ ] Check webhook trigger is receiving the data (look at execution input)
- [ ] Verify JSON field names match (case-sensitive!)
- [ ] Check API debug logs for what data is being sent

## Additional Resources

- [n8n Expression Documentation](https://docs.n8n.io/code-examples/expressions/)
- [n8n Webhook Node Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n Set Node Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.set/)

## Training Notes for Interns

**Key Learning Points:**

1. **Always test expressions** - Use n8n's "Test step" feature
2. **Prefer `$input.first()`** - More reliable than node references
3. **Check data flow** - Each node receives input from previous node
4. **Debug with logs** - Add debug statements in API to see what's received
5. **Use Postman** - Direct testing helps isolate issues
6. **Version matters** - n8n syntax has changed over versions

**Common Mistakes:**

- Using old node reference syntax
- Typos in field names (case-sensitive!)
- Forgetting `.json` accessor
- Not saving workflow after changes
- Workflow not activated (toggle off)

**Best Practices:**

- Use descriptive node names
- Test each node individually
- Keep expressions simple
- Document complex workflows
- Use consistent naming (taskId, not task_id or TaskId)

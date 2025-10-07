# Fix n8n Workflow Expressions

## Problem
The webhook endpoint is being called, but `taskId`, `conversationId`, and `userId` are all `null`.

## Root Cause
The n8n expressions aren't correctly reading from the Webhook Trigger node.

Current syntax (not working):
```
{{ $('Webhook Trigger').item.json.taskId }}
{{ $('Webhook Trigger').item.json.conversationId }}
{{ $('Webhook Trigger').item.json.userId }}
```

## Solution
Update all "Set" nodes to use the correct n8n expression syntax. In n8n, when referencing previous node data:

**Option 1: Use input reference (recommended)**
```
{{ $json.taskId }}
{{ $json.conversationId }}
{{ $json.userId }}
```

**Option 2: Use node reference with proper syntax**
```
{{ $node["Webhook Trigger"].json.taskId }}
{{ $node["Webhook Trigger"].json.conversationId }}
{{ $node["Webhook Trigger"].json.userId }}
```

## Nodes to Update

All "Emit XXX" Set nodes need to be updated:

1. **Emit Started** - Add these fields:
   - `conversationId`: `{{ $json.conversationId }}`
   - `userId`: `{{ $json.userId }}`
   - Fix `taskId`: `{{ $json.taskId }}`

2. **Emit Web Post Complete** - Add these fields:
   - `conversationId`: `{{ $json.conversationId }}`
   - `userId`: `{{ $json.userId }}`
   - Fix `taskId`: `{{ $json.taskId }}`

3. **Emit SEO Complete** - Add these fields:
   - `conversationId`: `{{ $json.conversationId }}`
   - `userId`: `{{ $json.userId }}`
   - Fix `taskId`: `{{ $json.taskId }}`

4. **Emit Social Complete** - Add these fields:
   - `conversationId`: `{{ $json.conversationId }}`
   - `userId`: `{{ $json.userId }}`
   - Fix `taskId`: `{{ $json.taskId }}`

5. **Emit Completed** - Add these fields:
   - `conversationId`: `{{ $json.conversationId }}`
   - `userId`: `{{ $json.userId }}`
   - Fix `taskId`: `{{ $json.taskId }}`

## How to Fix in n8n UI

1. Open workflow "Marketing Swarm - Major Announcement" in n8n UI
2. Click on the first "Emit Started" Set node
3. Scroll to the `taskId` string parameter
4. Change from `{{ $('Webhook Trigger').item.json.taskId }}` to `{{ $json.taskId }}`
5. Add new string parameters:
   - Name: `conversationId`, Value: `{{ $json.conversationId }}`
   - Name: `userId`, Value: `{{ $json.userId }}`
6. Repeat for all other "Emit XXX" nodes
7. Save and activate the workflow

## Verification

After fixing, trigger the workflow again:
```bash
./test-marketing-swarm-curl.sh
```

Check the API logs - you should now see:
```
Request body: {"taskId":"test-task-1759861627","conversationId":"test-conv-1759861627","userId":"test-user-1759861627",...}
```

Instead of:
```
Request body: {"taskId":null,"conversationId":null,"userId":null,...}
```

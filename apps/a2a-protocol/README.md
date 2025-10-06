# @orchestrator-ai/a2a-protocol

**Agent-to-Agent JSON-RPC 2.0 Protocol Types**

This package contains the shared TypeScript types for the A2A (Agent-to-Agent) protocol, ensuring both frontend and backend maintain the same API contract.

## Purpose

- **Single Source of Truth**: Protocol types defined once, used everywhere
- **Type Safety**: Compile-time validation of requests and responses
- **Contract Enforcement**: Both frontend and backend MUST conform to these types
- **Version Control**: Protocol changes are tracked and explicit

## Installation

```bash
# Build the protocol types
cd apps/a2a-protocol
npm install
npm run build

# In apps/api or apps/web
npm install @orchestrator-ai/a2a-protocol
```

## Usage

### Frontend (Sending Requests)

```typescript
import { A2ATaskRequest, AgentTaskMode } from '@orchestrator-ai/a2a-protocol';

const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  id: crypto.randomUUID(),
  method: 'plan',
  params: {
    userMessage: 'Create a blog post plan',
    conversationId: 'conv-uuid',
    payload: {
      action: 'create',
    },
  },
};
```

### Backend (Receiving Requests)

```typescript
import { A2ATaskRequest, isA2ATaskRequest } from '@orchestrator-ai/a2a-protocol';

if (isA2ATaskRequest(body)) {
  const { method, params } = body;
  // Process request with type safety
}
```

### Backend (Sending Responses)

```typescript
import { A2ATaskSuccessResponse, TaskResponse } from '@orchestrator-ai/a2a-protocol';

const taskResponse: TaskResponse = {
  success: true,
  mode: AgentTaskMode.PLAN,
  payload: {
    content: { plan: {...}, version: {...} },
  },
};

const response: A2ATaskSuccessResponse = {
  jsonrpc: '2.0',
  id: requestId,
  result: taskResponse,
};
```

### Frontend (Receiving Responses)

```typescript
import {
  A2ATaskResponse,
  isJsonRpcSuccessResponse,
  isJsonRpcErrorResponse
} from '@orchestrator-ai/a2a-protocol';

const data: A2ATaskResponse = await response.json();

if (isJsonRpcSuccessResponse(data)) {
  const taskResponse = data.result;
  // Handle success
} else if (isJsonRpcErrorResponse(data)) {
  const error = data.error;
  // Handle error
}
```

## Protocol Structure

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "plan",
  "params": {
    "userMessage": "User's message",
    "conversationId": "conv-uuid",
    "payload": {
      "action": "create",
      ...
    },
    "metadata": {
      ...
    }
  }
}
```

### Success Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "result": {
    "success": true,
    "mode": "plan",
    "payload": {
      "content": {...}
    }
  }
}
```

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {...}
  }
}
```

## Key Types

- `A2ATaskRequest` - Complete JSON-RPC 2.0 request
- `TaskRequestParams` - A2A-specific request parameters
- `A2ATaskSuccessResponse` - Success response
- `A2ATaskErrorResponse` - Error response
- `TaskResponse` - Task result payload
- `AgentTaskMode` - Available agent modes

## Type Guards

- `isJsonRpcRequest(obj)` - Check if object is JSON-RPC request
- `isJsonRpcSuccessResponse(obj)` - Check if object is success response
- `isJsonRpcErrorResponse(obj)` - Check if object is error response
- `isA2ATaskRequest(obj)` - Check if object is A2A task request
- `isTaskResponse(obj)` - Check if object is task response

## License

MIT

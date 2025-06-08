# A2AAgentBaseService Design Document

## Overview

The `A2AAgentBaseService` is the core service class that implements the Agent-to-Agent (A2A) protocol specification. It provides a complete foundation for JSON-RPC 2.0 communication, agent card generation, task lifecycle management, and error handling.

## Architecture

### Class Hierarchy
```
BaseService (abstract)
├── A2AAgentBaseService (concrete implementation)
    ├── MCPContextAgentBaseService (extends with markdown context)
    └── AgentWithFunctionBaseService (extends with function registration)
```

### Core Responsibilities

1. **JSON-RPC 2.0 Protocol Compliance**
   - Request validation and parsing
   - Response formatting
   - Error handling with standard codes
   - Batch request support
   - Notification handling

2. **Agent Card Generation**
   - A2A protocol compliant metadata
   - Agent capabilities discovery
   - Endpoint registration
   - Version management

3. **Task Lifecycle Management**
   - Task creation and validation
   - Execution coordination
   - State tracking and transitions
   - Resource cleanup

4. **Error Handling & Logging**
   - Structured error responses
   - Comprehensive logging
   - Audit trail maintenance
   - Performance monitoring

## Public Interface

### Core Methods

```typescript
// JSON-RPC Processing
processTask(taskRequest: JsonRpcRequest): Promise<JsonRpcResponse>
processBatch(batchRequest: JsonRpcRequest[]): Promise<JsonRpcResponse[]>

// Agent Metadata
getAgentCard(): Promise<AgentCard>
getCapabilities(): string[]
getEndpoints(): AgentEndpoints

// Task Management
createTask(taskData: TaskCreationRequest): Promise<Task>
updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>
getTaskStatus(taskId: string): Promise<TaskStatus>
cancelTask(taskId: string): Promise<void>

// Health & Monitoring
getHealthStatus(): Promise<HealthStatus>
getMetrics(): Promise<AgentMetrics>
```

### Abstract Methods (for derived classes)

```typescript
protected getAgentName(): string
protected getAgentType(): string
protected getAgentCapabilities(): string[]
protected executeTask(method: string, params: any): Promise<any>
```

## Data Structures

### JSON-RPC Types
```typescript
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}
```

### Agent Card Types
```typescript
interface AgentCard {
  name: string;
  type: string;
  version: string;
  capabilities: string[];
  endpoints: AgentEndpoints;
  protocol: string;
  metadata?: Record<string, any>;
}

interface AgentEndpoints {
  tasks: string;
  health: string;
  agent?: string;
}
```

### Task Management Types
```typescript
interface Task {
  id: string;
  method: string;
  params: any;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: JsonRpcError;
}

enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}
```

## Error Codes

Following JSON-RPC 2.0 specification:

- `-32700`: Parse error
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000 to -32099`: Server error range

## Implementation Strategy

### Phase 1: Enhanced JSON-RPC Support
- Upgrade existing JSON-RPC handling
- Add batch request support
- Implement proper error codes
- Add request validation

### Phase 2: Task Lifecycle Management
- Add task creation and tracking
- Implement status management
- Add timeout handling
- Resource cleanup

### Phase 3: Enhanced Agent Cards
- Structured metadata
- Capability discovery
- Dynamic endpoint registration
- Version management

### Phase 4: Logging & Monitoring
- Structured logging integration
- Performance metrics
- Audit trail
- Health monitoring

## Extensibility Points

1. **Custom Method Handlers**: Override `executeTask` for specific agent logic
2. **Enhanced Agent Cards**: Override `getAgentCard` for additional metadata
3. **Custom Validation**: Override validation methods for specific requirements
4. **Logging Integration**: Pluggable logging providers
5. **Metrics Collection**: Configurable metrics collectors

## Security Considerations

1. **Input Validation**: All requests validated against JSON-RPC schema
2. **Method Authorization**: Configurable method access control
3. **Rate Limiting**: Built-in request throttling
4. **Audit Logging**: Complete request/response audit trail
5. **Error Sanitization**: No sensitive data in error responses

## Performance Requirements

- **Response Time**: < 100ms for simple operations
- **Throughput**: Support 1000+ requests/second
- **Memory Usage**: Efficient task tracking with cleanup
- **Batch Processing**: Optimized for batch operations

## Testing Strategy

1. **Unit Tests**: Each method with positive/negative scenarios
2. **Integration Tests**: End-to-end JSON-RPC compliance
3. **Performance Tests**: Load and stress testing
4. **Security Tests**: Input validation and error handling
5. **Compliance Tests**: JSON-RPC 2.0 specification validation 
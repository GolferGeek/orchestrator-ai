# Base Services API Reference

This document provides detailed API reference for all base service classes in the function-based agent architecture.

## A2AAgentBaseService

Base class for all agents providing core functionality.

### Constructor

```typescript
constructor(
  httpService?: HttpService,
  contextService?: AgentContextService
)
```

### Methods

#### `processRequest(body: any): Promise<any>`

Main entry point for processing agent requests.

**Parameters:**
- `body: any` - Request body containing prompt and other parameters

**Returns:** `Promise<any>` - Structured response with success status and data

**Example:**
```typescript
const response = await agent.processRequest({
  prompt: "Hello, world!",
  sessionId: "session123",
  userId: "user456"
});
```

#### `getAgentCard(): Promise<any>`

Returns agent metadata and status information.

**Returns:** `Promise<any>` - Agent card with name, type, and status

**Example Response:**
```json
{
  "name": "hr_assistant",
  "type": "specialists",
  "status": "active",
  "capabilities": ["employee_queries", "policy_info"],
  "loadedAt": "2024-01-15T10:30:00.000Z"
}
```

#### `getAgentName(): string`

Returns the agent's name derived from the class name.

**Returns:** `string` - Agent name in snake_case

#### `getAgentType(): string`

Returns the agent's type (e.g., "specialists", "generalists").

**Returns:** `string` - Agent type

---

## FunctionAgentBaseService

Service for TypeScript function-based agents.

### Constructor

```typescript
constructor(
  protected readonly llmService: LLMService,
  httpService?: HttpService,
  contextService?: AgentContextService
)
```

### Methods

#### `setAgentFunction(agentFunction: any): void`

Sets the pre-loaded agent function from the discovery service.

**Parameters:**
- `agentFunction: any` - The dynamically imported agent function

**Example:**
```typescript
// Called automatically by AgentDiscoveryService
service.setAgentFunction(importedFunction.executeAgentFunction);
```

#### `executeTask(method: string, params: any): Promise<any>`

Protected method that executes the agent function with standardized parameters.

**Parameters:**
- `method: string` - HTTP method or action name
- `params: any` - Request parameters

**Returns:** `Promise<any>` - Structured response

**Internal Parameter Conversion:**
```typescript
const functionParams: AgentFunctionParams = {
  userMessage: string,
  sessionId: string,
  conversationHistory: any[],
  currentUser: any,
  authToken: string,
  llmService: LLMService,
  metadata: {
    method: string,
    originalParams: any,
    agentName: string,
    timestamp: string
  }
};
```

#### `getAgentCard(): Promise<any>`

Extended agent card with function status.

**Returns:** Enhanced agent card with function loading status

**Example Response:**
```json
{
  "name": "blog_post",
  "type": "specialists", 
  "status": "active",
  "functionStatus": "loaded",
  "loadedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## PythonFunctionAgentBaseService

Service for Python function-based agents.

### Constructor

```typescript
constructor(
  protected readonly llmService: LLMService,
  httpService?: HttpService,
  contextService?: AgentContextService
)
```

### Methods

#### `setPythonScriptPath(scriptPath: string): void`

Sets the path to the Python script for this agent.

**Parameters:**
- `scriptPath: string` - Absolute path to the agent-function.py file

**Example:**
```typescript
// Called automatically by AgentDiscoveryService
service.setPythonScriptPath('/path/to/agent-function.py');
```

#### `setPythonExecutable(executable: string): void`

Sets the Python executable to use for script execution.

**Parameters:**
- `executable: string` - Python executable name or path (default: 'python3')

**Example:**
```typescript
service.setPythonExecutable('/usr/bin/python3.11');
```

#### `executeTask(method: string, params: any): Promise<any>`

Protected method that executes the Python script with JSON communication.

**Parameters:**
- `method: string` - HTTP method or action name
- `params: any` - Request parameters

**Returns:** `Promise<any>` - Structured response from Python script

**Python Script Interface:**
```python
# Input via command line argument (JSON string)
input_data = json.loads(sys.argv[1])

# Expected input format:
{
  "userMessage": "string",
  "sessionId": "string", 
  "conversationHistory": [],
  "currentUser": {},
  "authToken": "string",
  "metadata": {
    "method": "string",
    "originalParams": {},
    "agentName": "string",
    "timestamp": "string"
  }
}

# Expected output format (printed to stdout):
{
  "success": true,
  "message": "Response message",
  "data": {},
  "metadata": {}
}
```

#### `executePythonScript(params: AgentFunctionParams): Promise<any>`

Private method that manages Python subprocess execution.

**Features:**
- 30-second execution timeout
- JSON input/output handling
- Error capture and reporting
- Process cleanup

**Error Handling:**
```typescript
// Timeout after 30 seconds
setTimeout(() => {
  if (!pythonProcess.killed) {
    pythonProcess.kill();
    reject(new Error('Python script execution timed out'));
  }
}, 30000);
```

---

## AgentFunctionParams Interface

Standard parameters passed to agent functions.

```typescript
interface AgentFunctionParams {
  userMessage: string;           // Main user input
  sessionId?: string;           // Session identifier
  conversationHistory?: any[];  // Previous messages
  currentUser?: any;           // User information
  authToken?: string;          // Authentication token
  llmService?: LLMService;     // LLM service instance (TypeScript only)
  metadata?: {                 // Additional metadata
    method: string;
    originalParams: any;
    agentName: string;
    timestamp: string;
    [key: string]: any;
  };
}
```

## AgentFunctionResponse Interface

Standard response format from agent functions.

```typescript
interface AgentFunctionResponse {
  success: boolean;           // Operation success status
  response?: string;         // Main response message
  message?: string;          // Alternative message field
  data?: any;               // Additional response data
  metadata?: {              // Response metadata
    agentName: string;
    agentType: string;
    executionType: string;
    processedAt: string;
    [key: string]: any;
  };
  error?: string;           // Error message if success is false
}
```

## Error Handling

### Error Response Format

All base services return consistent error responses:

```typescript
{
  success: false,
  error: "Error message",
  response: "User-friendly fallback message",
  metadata: {
    agentName: "agent_name",
    agentType: "specialists",
    executionType: "function_error|python_script_error",
    errorDetails: "Detailed error information",
    processedAt: "2024-01-15T10:30:00.000Z"
  }
}
```

### Fallback Mechanisms

1. **FunctionAgentBaseService**: Falls back to context processing if no function is loaded
2. **PythonFunctionAgentBaseService**: Falls back to context processing if Python script fails
3. **Context Processing**: Uses LLM with agent context as final fallback

### Timeout Handling

- **Python Scripts**: 30-second execution timeout
- **TypeScript Functions**: No timeout (relies on underlying LLM timeouts)
- **HTTP Requests**: Configured via NestJS timeout interceptors

## Performance Considerations

### Caching

- Agent functions are loaded once at startup
- Python script paths are cached after discovery
- LLM responses can be cached based on configuration

### Resource Management

- Python processes are automatically cleaned up
- Memory usage is monitored and logged
- File descriptors are properly closed

### Monitoring

All base services provide built-in logging:

```typescript
// Function execution logging
this.functionLogger.debug(`Function executed successfully for ${agentName}`);

// Python execution logging  
this.pythonLogger.debug(`Python script executed successfully for ${agentName}`);

// Error logging with full context
this.pythonLogger.error(`Python script execution error for ${agentName}:`, error);
```

---

## Usage Examples

### Creating a TypeScript Function Agent

```typescript
@Injectable()
export class MyAgentService extends FunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(llmService, httpService, contextService);
  }
}
```

### Creating a Python Function Agent

```typescript
@Injectable()
export class MyPythonAgentService extends PythonFunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(llmService, httpService, contextService);
  }
}
```

### Testing Agent Responses

```typescript
// Test TypeScript agent
const response = await typescriptAgent.processRequest({
  prompt: "Test message",
  sessionId: "test-session"
});

expect(response.success).toBe(true);
expect(response.metadata.agentName).toBe("my_agent");

// Test Python agent
const pythonResponse = await pythonAgent.processRequest({
  prompt: "Test Python message", 
  sessionId: "test-session"
});

expect(pythonResponse.success).toBe(true);
expect(pythonResponse.metadata.executionType).toBe("python_script");
``` 
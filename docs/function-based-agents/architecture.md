# Architecture Overview

This document provides a deep dive into the function-based agent architecture, explaining how the system works under the hood and why it's designed this way.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator AI Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                    NestJS API Gateway                          │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Dynamic Agent │  │ Agent Discovery│  │ Agent Management │   │
│  │ Controller    │  │ Service        │  │ Service          │   │
│  └───────────────┘  └────────────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                   Agent Base Services                          │
│  ┌─────────────────────────────────────────────────────────────┤
│  │              A2AAgentBaseService                            │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │  │ FunctionAgentBase   │  │ PythonFunctionAgentBase    │   │
│  │  │ Service             │  │ Service                     │   │
│  │  │ (TypeScript)        │  │ (Python Execution)          │   │
│  │  └─────────────────────┘  └─────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┤
├─────────────────────────────────────────────────────────────────┤
│                    Agent Implementations                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ TypeScript      │  │ Python          │  │ Context         │ │
│  │ Function Agents │  │ Function Agents │  │ Based Agents    │ │
│  │                 │  │                 │  │ (Legacy)        │ │
│  │ agent-service.ts│  │ agent-service.ts│  │ agent-service.ts│ │
│  │ agent-function. │  │ agent-function. │  │ agent-context.  │ │
│  │ ts              │  │ py              │  │ md              │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Discovery Service

**Purpose**: Automatically find, register, and instantiate agents at startup.

**Key Features**:
- Scans `src/agents/actual/` directory recursively
- Identifies agent services by naming convention (`*Service` classes)
- Discovers both TypeScript and Python function files
- Registers agents with the dynamic router
- Handles hot-reloading in development

**Discovery Process**:
```typescript
// 1. Scan for agent-service.ts files
const serviceFiles = glob('**/agent-service.ts', { cwd: agentsDir });

// 2. Import and instantiate service classes  
const ServiceClass = await import(servicePath);
const serviceInstance = new ServiceClass(dependencies...);

// 3. Discover function files
const functionPath = path.join(agentDir, 'agent-function.ts');
const pythonFunctionPath = path.join(agentDir, 'agent-function.py');

// 4. Register with router
this.registerAgent(agentName, serviceInstance);
```

### 2. Base Service Hierarchy

**A2AAgentBaseService** (Root)
- Common functionality for all agents
- Context management and session handling
- LLM integration and response formatting
- Error handling and logging

**FunctionAgentBaseService** (TypeScript)
- Dynamic import of `agent-function.ts` files
- Type-safe function execution
- Parameter injection and validation
- Built-in retry logic and caching

**PythonFunctionAgentBaseService** (Python)
- Python subprocess execution with timeout
- JSON serialization/deserialization
- Error capture and fallback handling
- Performance monitoring

### 3. Agent Function Interface

**TypeScript Interface**:
```typescript
export interface AgentFunction {
  (params: AgentFunctionParams): Promise<AgentFunctionResponse>;
}

export interface AgentFunctionParams {
  prompt: string;
  context?: AgentContext;
  llm?: BaseLLM;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AgentFunctionResponse {
  success: boolean;
  message: string;
  data?: any;
  metadata?: Record<string, any>;
}
```

**Python Interface**:
```python
def execute_agent_function(params: dict) -> dict:
    """
    Args:
        params: {
            "prompt": str,
            "context": dict,
            "sessionId": str,
            "userId": str,
            "metadata": dict
        }
    
    Returns:
        {
            "success": bool,
            "message": str,
            "data": any,
            "metadata": dict
        }
    """
```

### 4. Dynamic Routing System

**Route Pattern**: `/agents/:agentType/:agentName/tasks`

**Request Flow**:
1. **Route Matching**: NestJS dynamic controller matches the route
2. **Agent Resolution**: Controller looks up agent instance by name
3. **Function Execution**: Base service executes the appropriate function
4. **Response Formatting**: Standardized JSON response returned

**Controller Logic**:
```typescript
@Post(':agentType/:agentName/tasks')
async executeAgentTask(
  @Param('agentType') agentType: string,
  @Param('agentName') agentName: string,
  @Body() body: any
): Promise<any> {
  const agent = this.agentDiscovery.getAgent(`${agentType}_${agentName}`);
  return await agent.processRequest(body);
}
```

## Design Principles

### 1. Convention over Configuration

**Zero Configuration Required**:
- Place files in correct directory structure
- Follow naming conventions (`agent-service.ts`, `agent-function.ts`)
- System automatically discovers and registers agents

**Benefits**:
- Faster development cycles
- Reduced boilerplate code
- Consistent project structure
- Easy onboarding for new developers

### 2. Multi-Language Support

**Language Agnostic Design**:
- TypeScript for type safety and rapid development
- Python for AI/ML workflows and LangGraph integration
- Common interface for all implementations
- Seamless interoperability

**Execution Models**:
- **TypeScript**: In-process execution with dynamic imports
- **Python**: Subprocess execution with JSON communication
- **Context**: Fallback to LLM-based processing

### 3. Type Safety and Developer Experience

**TypeScript Benefits**:
- Full IntelliSense support
- Compile-time error checking
- Refactoring assistance
- Interface documentation

**Development Tools**:
- Hot reloading for rapid iteration
- Comprehensive error messages
- Built-in debugging support
- Testing utilities

### 4. Scalability and Performance

**Scalability Features**:
- Automatic agent discovery scales to thousands of agents
- Function-level caching for improved performance
- Connection pooling for external services
- Horizontal scaling support

**Performance Optimizations**:
- Lazy loading of agent functions
- Efficient subprocess management for Python
- Response caching where appropriate
- Request/response compression

## Data Flow

### TypeScript Agent Execution

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ HTTP Request│───▶│ Dynamic         │───▶│ FunctionAgent    │
│ POST /agents│    │ Controller      │    │ BaseService      │
│ /type/name  │    │                 │    │                  │
└─────────────┘    └─────────────────┘    └──────────────────┘
                                                     │
                   ┌─────────────────┐               ▼
                   │ AgentFunction   │    ┌──────────────────┐
                   │ Response        │◀───│ Dynamic Import   │
                   │                 │    │ agent-function.ts│
                   └─────────────────┘    └──────────────────┘
                            │                       │
                            ▼                       ▼
                   ┌─────────────────┐    ┌──────────────────┐
                   │ HTTP Response   │    │ executeAgent     │
                   │ JSON            │    │ Function()       │
                   └─────────────────┘    └──────────────────┘
```

### Python Agent Execution

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ HTTP Request│───▶│ Dynamic         │───▶│ PythonFunction   │
│ POST /agents│    │ Controller      │    │ AgentBaseService │
│ /type/name  │    │                 │    │                  │
└─────────────┘    └─────────────────┘    └──────────────────┘
                                                     │
                   ┌─────────────────┐               ▼
                   │ AgentFunction   │    ┌──────────────────┐
                   │ Response        │◀───│ Python Subprocess│
                   │                 │    │ agent-function.py│
                   └─────────────────┘    └──────────────────┘
                            │                       │
                            ▼                       ▼
                   ┌─────────────────┐    ┌──────────────────┐
                   │ HTTP Response   │    │ JSON stdout      │
                   │ JSON            │    │ capture          │
                   └─────────────────┘    └──────────────────┘
```

## Error Handling Strategy

### Layered Error Handling

1. **Function Level**: Agent functions handle their own business logic errors
2. **Base Service Level**: Base services handle execution errors and provide fallbacks
3. **Controller Level**: Controllers handle routing and validation errors
4. **Global Level**: Global exception filters handle unexpected errors

### Fallback Mechanisms

1. **Python Execution Failure**: Falls back to context-based LLM processing
2. **TypeScript Function Error**: Returns structured error with debug information
3. **Discovery Failure**: Logs warning and continues with other agents
4. **LLM Service Failure**: Provides generic error response

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string; // Only in development
  };
  timestamp: string;
  requestId: string;
}
```

## Security Considerations

### Input Validation
- All parameters validated against schemas
- SQL injection prevention
- XSS protection for string inputs
- File path traversal prevention

### Execution Isolation
- Python processes run in isolated subprocesses
- Timeout limits prevent infinite execution
- Resource limits prevent system overload
- No direct file system access from functions

### Authentication & Authorization
- JWT token validation
- Test API key for development
- Role-based access control ready
- Agent-level permission system

## Monitoring and Observability

### Built-in Logging
- Structured logging with consistent format
- Performance metrics collection
- Error tracking and alerting
- Request/response tracing

### Metrics Collection
- Agent execution time
- Success/failure rates
- Resource utilization
- User interaction patterns

### Development Tools
- Real-time log streaming
- Performance profiling
- Memory usage monitoring
- Hot reload notifications

---

This architecture provides a solid foundation for building scalable, maintainable, and powerful AI agent systems while maintaining developer productivity and system reliability. 
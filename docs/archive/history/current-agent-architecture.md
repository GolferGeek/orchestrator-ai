# Current Agent Architecture

## Overview
This document captures the current state of the agent architecture as of January 14, 2025, before the planned architectural changes.

## Agent Base Class Hierarchy

### A2AAgentBaseService (Base Class)
**Location**: `apps/api/src/agents/base/implementations/base-services/a2a-base/a2a-agent-base.service.ts`

**Purpose**: Minimal A2A Agent Base Service containing only truly common functionality across all agent types:
- JSON-RPC protocol processing
- Logging and authentication
- Agent registration and lifecycle

**Key Features**:
- Abstract `executeTask(method: string, params: any)` method
- JSON-RPC request processing
- Agent lifecycle management (OnModuleInit, OnModuleDestroy)
- Agent registration with agent pool
- Path discovery and management

**Core Services**:
```typescript
protected agentRegistrationService: AgentRegistrationService;
protected jsonRpcProtocolService: JsonRpcProtocolService;
protected loggingService: LoggingService;
protected authService: AuthService;
protected configurationService: ConfigurationService;
```

### ContextAgentBaseService (LLM-Based)
**Location**: `apps/api/src/agents/base/implementations/base-services/context/context-agent-base.service.ts`

**Purpose**: Context-aware agent that processes requests using LLM with optional context data.

**Key Features**:
- LLM integration via LLMService
- Context data management (loaded from agent directories)
- Personalized greeting generation
- Fallback processing when context unavailable
- AgentContextService for YAML-based skills and metadata

**Dependencies**:
```typescript
constructor(
  protected readonly httpService: HttpService,
  protected readonly llmService: LLMService,
  // Optional base services...
)
```

**Processing Flow**:
1. Extract user message from params
2. Check for greeting requests (fast path)
3. Process with LLM using context data
4. Return structured response with metadata

### FunctionAgentBaseService (Function-Based)
**Location**: `apps/api/src/agents/base/implementations/base-services/function/function-agent-base.service.ts`

**Purpose**: Agent that executes pre-loaded functions from AgentDiscoveryService.

**Key Features**:
- Pre-loaded function execution
- LLM service wrapping for metadata tracking
- Function parameter standardization
- Fallback to context processing when function unavailable
- Aggregated LLM metadata collection

**Dependencies**:
```typescript
constructor(
  protected readonly httpService: HttpService,
  protected readonly llmService: LLMService,
  // Optional base services...
)
```

**Processing Flow**:
1. Check for pre-loaded function availability
2. Create wrapped LLM service for metadata tracking
3. Execute function with standardized parameters
4. Aggregate and return metadata

### ExternalA2AAgentBaseService (External Proxy)
**Location**: `apps/api/src/agents/base/implementations/base-services/external/external-a2a-agent-base.service.ts`

**Purpose**: Lightweight proxy for external A2A-compliant agents. Does NOT extend A2AAgentBaseService because external agents already implement full A2A protocol.

**Key Features**:
- Local configuration loading from agent.yaml
- Remote agent capability discovery
- Request forwarding with retry logic
- Authentication header management
- Configuration validation

**Configuration Structure**:
```typescript
interface ExternalA2AConfiguration {
  endpoint: string;
  protocol: 'A2A';
  timeout?: number;
  authentication?: AuthConfig;
  retry?: RetryConfig;
  capabilities?: string[];
  required_env_vars?: string[];
}
```

## Service Injection Patterns

### Base Class Pattern
All agent base services use optional dependency injection for modularity:

```typescript
constructor(
  protected readonly httpService: HttpService,
  agentRegistrationService?: AgentRegistrationService,
  jsonRpcProtocolService?: JsonRpcProtocolService,
  loggingService?: LoggingService,
  authService?: AuthService,
  configurationService?: ConfigurationService,
) {
  // Fallback to default instances if not provided
  this.agentRegistrationService = agentRegistrationService || new AgentRegistrationService(httpService);
  // ...
}
```

### Specialized Services
Context and Function agents require additional services:
- **LLMService**: For language model integration
- **SessionsService**: Currently only in OrchestratorService

## Agent Discovery and Registration

### Discovery Process
1. **AgentDiscoveryService** scans `src/agents/actual/` directories
2. Loads agent.yaml configuration files
3. Determines agent type (context, function, external)
4. Creates appropriate base service instance
5. Calls `setDiscoveredPath()` to set agent path

### Registration Process
1. Agent initialization triggers `onModuleInit()`
2. Registration handled by **AppService** via **AgentFactoryService**
3. Agents no longer self-register to avoid conflicts
4. Registration includes agent metadata, capabilities, and skills

## Session Management (Current State)

### Orchestrator-Only Pattern
- **Only OrchestratorService** has SessionsService injected
- All session persistence happens in orchestrator layer
- Agents remain stateless and session-agnostic
- Session continuity maintained through orchestrator delegation

### Session Flow
1. Frontend sends message to orchestrator with sessionId
2. Orchestrator saves user message to session
3. Orchestrator delegates to appropriate agent
4. Agent processes request without session awareness
5. Orchestrator saves agent response to session
6. Response returned to frontend with session context

## Agent Lifecycle

### Initialization
1. Module initialization (`onModuleInit()`)
2. Agent path discovery
3. Service injection and fallback setup
4. Registration with agent pool (via AgentFactoryService)

### Request Processing
1. JSON-RPC request received
2. Protocol processing in base class
3. Delegation to abstract `executeTask()` method
4. Specialized processing in derived class
5. Response formatting and return

### Destruction
1. Module destruction (`onModuleDestroy()`)
2. Agent unregistration
3. Resource cleanup

## Configuration Management

### Agent.yaml Structure
```yaml
agent:
  name: "Agent Name"
  description: "Agent description"
  type: "context" | "function" | "external"
  
# For external agents
external_a2a_configuration:
  endpoint: "https://example.com/agent"
  protocol: "A2A"
  timeout: 30000
  authentication:
    type: "bearer"
    value: "${API_KEY}"
  retry:
    attempts: 3
    delay: 1000
    backoff: "exponential"
```

### Environment Variables
- **API_HOST**: Agent API host (default: localhost)
- **API_PORT**: Agent API port (default: 4000)
- **API_BASE_URL**: Base URL for agent registration
- **AGENT_BASE_URL**: Agent endpoint base URL

## Current Limitations

### Session Awareness
- Agents cannot directly access session history
- No conversation context beyond single request
- Session state management centralized in orchestrator

### Statelessness
- Agents don't maintain state between requests
- No memory of previous interactions
- Limited ability for long-running tasks

### Direct Access
- Agents not directly accessible with session context
- All requests must flow through orchestrator
- No support for direct agent-to-frontend communication with sessions

## Agent Pool Integration

### Registration Data
```typescript
interface AgentInfo {
  id: string;
  name: string;
  type: 'orchestrator' | 'specialist' | 'manager' | 'external';
  path: string;
  url: string;
  description: string;
  capabilities: string[];
  skills: string[];
  inputModes: string[];
  outputModes: string[];
  metadata: Record<string, any>;
}
```

### URL Pattern
Agent URLs follow the pattern: `{baseUrl}/agents/{type}s/{name}/tasks`
- **Base URL**: From API_BASE_URL environment variable
- **Type**: Agent type with 's' suffix (specialists, externals, etc.)
- **Name**: Agent name in lowercase with underscores

## Future Architecture Considerations

### Pending Questions
1. Should agents be session-aware or remain stateless?
2. How to handle long-running tasks across agent instances?
3. What role should direct agent access play?
4. How to maintain session consistency in distributed scenarios?
5. Should session management be centralized or distributed?

### Current Strengths
- Clean separation of concerns
- Modular service injection
- Consistent JSON-RPC protocol
- Flexible agent discovery
- Type-safe agent base classes

### Current Gaps
- No session awareness in agents
- Limited support for long-running tasks
- Orchestrator bottleneck for all session operations
- No direct agent access with session context
# A2A Architecture Refactor - Product Requirements Document

## Project Overview

### Background
The current A2A agent framework has grown organically, resulting in a monolithic `A2AAgentBaseService` that handles too many responsibilities (~1500 lines). As we add new agent types (API agents, external A2A agents), this architecture becomes unsustainable due to code duplication and bloated base classes.

### Objectives
1. **Decompose** the monolithic A2AAgentBaseService into focused, single-responsibility services
2. **Implement** ApiAgentBaseService to wrap external API endpoints (like N8N agents) 
3. **Implement** ExternalA2AAgentBaseService to connect to remote A2A agents
4. **Maintain** backward compatibility with existing agents
5. **Ensure** comprehensive test coverage throughout refactoring

## Current State Analysis

### Current Agent Types
- **Function Agents** (TypeScript): `agent-function.ts` + `FunctionAgentBaseService`
- **Python Function Agents**: `agent-function.py` + `PythonFunctionAgentBaseService`  
- **Context Agents**: `agent-context.md` + `ContextAgentBaseService`
- **Orchestrator**: Special-case orchestration logic

### Current Base Service Responsibilities
- YAML context parsing and environment variable substitution
- Agent pool registration and heartbeat management
- JSON-RPC protocol handling and request/response formatting
- Task lifecycle management
- Agent metadata/card generation from directory structure
- HTTP service integration
- Evaluation service wrapping
- Discovery and path management

### Problem Statement
- Single Responsibility Principle violations
- Code duplication across agent types
- Difficulty adding new agent types
- Testing complexity due to monolithic structure
- Performance overhead for agents that don't need all capabilities

## Target Architecture

### Service Decomposition

#### Core Services (Injectable)
1. **ConfigurationService**
   - YAML parsing and validation
   - Environment variable substitution
   - Configuration schema validation
   - File path resolution

2. **AgentRegistrationService**
   - Agent pool registration
   - Heartbeat management
   - Agent lifecycle events
   - Discovery service integration

3. **JsonRpcProtocolService**
   - JSON-RPC request/response handling
   - Protocol validation
   - Error standardization
   - Method routing

4. **TaskLifecycleService**
   - Task creation and management
   - Status tracking
   - Task history
   - Cleanup operations

5. **AgentMetadataService**
   - Agent card generation
   - Capability detection
   - Directory structure analysis
   - Metadata caching

6. **EvaluationWrapperService**
   - Evaluation integration
   - Performance metrics
   - Error tracking
   - Response validation

#### Refactored Base Class Hierarchy

```
A2AAgentBaseService (Lightweight orchestrator)
├── FunctionAgentBaseService (TypeScript functions)
├── PythonFunctionAgentBaseService (Python scripts)
├── ContextAgentBaseService (Markdown context)
├── ApiAgentBaseService (External APIs) [NEW]
└── ExternalA2AAgentBaseService (External A2A agents) [NEW]
```

### New Agent Type: API Agents

#### Directory Structure
```
agents/api/rules-of-golf/
├── agent.md                 # Agent metadata and configuration
└── agent-service.ts         # Optional custom logic (minimal)
```

#### Configuration Format (agent.md)
```markdown
# Agent: Rules of Golf Expert
## Description
Provides authoritative golf rules interpretations based on USGA/R&A rules.

## Configuration
- endpoint: https://golfergeek.app.n8n.cloud/webhook/8218497e-a07f-4516-a2cd-00044c8f9211
- method: POST
- timeout: 30000
- headers:
  - Content-Type: application/json

## Request Format
- body: JSON with "sessionId" and "prompt" fields
- example: {"sessionId": "myId", "prompt": "I hit my ball out past the white stakes. What does that mean, and is there a penalty?"}

## Response Format
- JSON response with rules explanation
- {
    "output": "Hitting your ball out of bounds past the white stakes means that the ball has crossed the boundary defined by those markers. When this occurs, it is considered out of bounds if the entire ball is outside of the boundary.\n\nIn this situation, there is a penalty: you must take a one-stroke penalty and replay the shot from the original position, known as \"stroke and distance.\" This means you add one penalty stroke to your score and hit your next shot from where your previous stroke was played."
}
```

#### ApiAgentBaseService Responsibilities
- HTTP client management
- Request/response transformation
- Authentication handling
- Timeout and retry logic
- Error handling and standardization
- Environment variable substitution for configuration

### New Agent Type: External A2A Agents

#### Directory Structure
```
agents/external/google-hello-world/
├── agent.md                 # Agent metadata and configuration
└── agent-service.ts         # Optional custom logic (minimal)

agents/external/travel-planner/
├── agent.md                 # Agent metadata and configuration
└── agent-service.ts         # Optional custom logic (minimal)
```

#### Configuration Format (agent.md) - Google Hello World
```markdown
# Agent: Google Hello World
## Description
Simple Hello World agent from Google's A2A samples repository for testing basic A2A protocol functionality.

## Configuration
- endpoint: https://hello-world-agent.googleapis.com/v1/agent
- protocol: A2A
- timeout: 10000
- authentication: none

## Capabilities
- Basic greeting responses
- A2A protocol validation
- Connection testing

## Testing
- Simple "hello" requests
- Protocol compliance validation
- Response time measurement
```

#### Configuration Format (agent.md) - Travel Planner
```markdown
# Agent: Travel Planning Assistant
## Description
Multi-agent travel planning system that coordinates weather data, search results, and LLM processing to provide comprehensive travel recommendations.

## Configuration
- endpoint: https://travel-planner-agent.example.com/v1/agent
- protocol: A2A
- timeout: 30000
- authentication: apikey
- apiKey: ${TRAVEL_PLANNER_API_KEY}

## Required Environment Variables
- TRAVEL_PLANNER_API_KEY: API key for travel planning service
- OPENWEATHER_API_KEY: OpenWeather API key for weather data
- BRAVE_SEARCH_API_KEY: Brave Search API key for location search

## Capabilities
- Weather data retrieval and analysis
- Location search and recommendations
- Travel itinerary planning
- Multi-agent coordination

## Testing
- Weather lookup requests
- Location search queries
- Full travel planning scenarios
```

#### ExternalA2AAgentBaseService Responsibilities
- A2A protocol client implementation
- Remote agent discovery and capability negotiation
- Task delegation and response handling
- Authentication management for external agents
- Connection pooling and retry logic
- Response validation and transformation

## Implementation Plan

### Phase 1: Pre-Refactor Validation
**Goal**: Ensure current system stability before changes

#### Tasks:
1. **Verify E2E Test Suite**
   - Run existing comprehensive A2A test
   - Validate all current agents (function, python, context, orchestrator)
   - Test HTTP endpoints and orchestrator delegation
   - Ensure test user account functionality
   - Document any test failures for resolution

2. **Baseline Performance Metrics**
   - Capture current response times
   - Memory usage patterns
   - Agent discovery time
   - Registration performance

### Phase 2: Service Decomposition
**Goal**: Break down monolithic base service without breaking existing functionality

#### Tasks:
1. **Create Core Services**
   - Implement ConfigurationService with YAML parsing
   - Implement AgentRegistrationService with pool management
   - Implement JsonRpcProtocolService with protocol handling
   - Implement TaskLifecycleService with task management
   - Implement AgentMetadataService with card generation
   - Implement EvaluationWrapperService with evaluation integration

2. **Refactor A2AAgentBaseService**
   - Inject and compose core services
   - Maintain public API compatibility
   - Remove direct implementation, delegate to services
   - Reduce from ~1500 lines to <200 lines

3. **Update Existing Agent Base Services**
   - FunctionAgentBaseService: Remove duplicated logic, use services
   - PythonFunctionAgentBaseService: Remove duplicated logic, use services
   - ContextAgentBaseService: Remove duplicated logic, use services
   - Maintain backward compatibility

4. **Critical Validation Checkpoint** ⚠️ **MANDATORY BEFORE PHASE 3**
   - **Run Full E2E Test Suite**: Comprehensive A2A test must pass completely
   - **Frontend UI Validation**: User to verify all existing agents visible and functional in UI
   - **Performance Baseline**: Confirm no regression in response times or functionality
   - **Zero Tolerance**: Any failures must be resolved before proceeding to API agent development
   - **Sign-off Required**: User approval needed before Phase 3 begins

### Phase 3: API Agent Implementation
**Goal**: Implement new ApiAgentBaseService and test with existing N8N agent

#### Tasks:
1. **Implement ApiAgentBaseService**
   - Extend refactored A2AAgentBaseService
   - HTTP client integration
   - Configuration parsing for API endpoints
   - Environment variable substitution
   - Request/response transformation
   - Authentication header management
   - Error handling and retry logic

2. **Update AgentDiscoveryService**
   - Recognize `agents/api/` directory pattern
   - Parse API agent configurations
   - Register API agents in agent pool

3. **Create Golf Rules API Agent**
   - Directory: `agents/api/rules-of-golf/`
   - Configuration with N8N endpoint details
   - Environment variables for API credentials

4. **Integration Testing**
   - Direct API agent HTTP calls
   - Orchestrator delegation to API agent
   - Error handling scenarios
   - Authentication failure handling

### Phase 4: External A2A Agent Implementation
**Goal**: Implement ExternalA2AAgentBaseService and integrate Google Hello World and Travel Planner agents

#### Tasks:
1. **Implement ExternalA2AAgentBaseService**
   - Extend refactored A2AAgentBaseService
   - A2A protocol client implementation
   - Remote agent discovery and capability negotiation
   - Authentication handling for external agents
   - Connection pooling and retry logic
   - Response validation and transformation

2. **Update AgentDiscoveryService**
   - Recognize `agents/external/` directory pattern
   - Parse External A2A agent configurations
   - Register External A2A agents in agent pool

3. **Create Google Hello World Agent**
   - Directory: `agents/external/google-hello-world/`
   - Configuration with Google A2A endpoint details
   - Basic A2A protocol testing capabilities

4. **Create Travel Planner Agent**
   - Directory: `agents/external/travel-planner/`
   - Configuration with travel planning endpoint details
   - Environment variables for required API keys
   - Multi-agent coordination capabilities

5. **Integration Testing**
   - Direct External A2A agent HTTP calls
   - Orchestrator delegation to External A2A agents
   - A2A protocol compliance validation
   - Authentication and API key handling

### Phase 5: Comprehensive Test Integration
**Goal**: Integrate all new agents into comprehensive test suite and frontend visibility

#### Tasks:
1. **Frontend Integration**
   - **Health Status Visibility**: All agents (API + External A2A) appear in frontend health checks
   - **Agent Status Dashboard**: Golf Rules, Google Hello World, and Travel Planner visible in status tests
   - **Orchestrator-Only Access**: All frontend interactions go through orchestrator (no direct agent calls from UI)

2. **Extend E2E Test Suite** 
   - **Direct API Testing**: Each new agent tested via direct HTTP endpoint (for future business integrations)
   - **Orchestrator Delegation Testing**: Each new agent tested via orchestrator delegation (matches frontend behavior)
   - **API Agent Tests**: Golf rules agent test cases, authentication scenarios, error conditions
   - **External A2A Agent Tests**: Hello World and Travel Planner test cases, A2A protocol validation
   - **Response Validation**: Proper parsing and formatting for all agent types
   - **Error Scenarios**: Network failures, authentication errors, timeouts for both agent types

3. **Performance Validation**
   - Compare pre/post refactor performance
   - Validate no regression in existing agents
   - Measure API agent response times
   - Measure External A2A agent response times
   - Memory usage validation

### Phase 5: Documentation & Cleanup
**Goal**: Complete documentation and prepare for future agent types

#### Tasks:
1. **Update Documentation**
   - Architecture diagrams
   - Service interaction flows
   - Configuration examples
   - Migration guides

2. **Code Quality**
   - Remove dead code
   - Update unit tests
   - Code coverage validation
   - Linting and formatting

## Test Requirements

### Existing Test Validation
- **Comprehensive A2A E2E Test**: Must pass before any refactoring begins
- **Agent Coverage**: Function, Python, Context, Orchestrator agents
- **HTTP Endpoint Testing**: Direct agent calls and orchestrator delegation
- **User Account Testing**: Test user authentication and access

### New Agent Tests

#### API Agent Tests (Golf Rules N8N)
- **E2E Direct HTTP Testing**: Golf Rules agent accessible via direct HTTP call (for business integrations)
- **E2E Orchestrator Testing**: Golf Rules agent callable through orchestrator (matches frontend behavior)
- **Frontend Visibility**: Agent appears in health checks and status dashboard (orchestrator-only access)
- **Request Format Validation**: Proper JSON structure and headers
- **Response Processing**: Correct parsing and formatting of N8N response
- **Authentication Testing**: API key handling and security (if needed)
- **Error Scenarios**: Network failures, authentication errors, timeouts

#### External A2A Agent Tests (Google Hello World & Travel Planner)
- **E2E Direct HTTP Testing**: Both agents accessible via direct HTTP calls (for business integrations)
- **E2E Orchestrator Testing**: Both agents callable through orchestrator (matches frontend behavior)
- **Frontend Visibility**: Both agents appear in health checks and status dashboard (orchestrator-only access)
- **A2A Protocol Compliance**: Proper A2A request/response handling
- **Authentication Testing**: API key management for Travel Planner
- **Capability Discovery**: Remote agent capability negotiation
- **Multi-Agent Coordination**: Travel Planner's weather + search integration
- **Error Scenarios**: Network failures, authentication errors, A2A protocol errors

### Agent Configuration Details

#### N8N Golf Rules API
**Endpoint Configuration**:
- URL: https://golfergeek.app.n8n.cloud/webhook/8218497e-a07f-4516-a2cd-00044c8f9211
- Method: POST
- Authentication: None (public webhook)
- Request format: `{"sessionId": "myId", "prompt": "I hit my ball out past the white stakes. What does that mean, and is there a penalty?"}`
- Response format: [To be determined during testing]

#### Google Hello World A2A Agent
**Endpoint Configuration**:
- URL: [To be determined from Google A2A samples]
- Protocol: A2A
- Authentication: None (public demo agent)
- Request format: Standard A2A protocol
- Response format: Standard A2A protocol

#### Travel Planner A2A Agent
**Endpoint Configuration**:
- URL: [To be determined from implementation]
- Protocol: A2A
- Authentication: API key required
- Required Environment Variables:
  - `TRAVEL_PLANNER_API_KEY`: Main travel planner service API key
  - `OPENWEATHER_API_KEY`: OpenWeather API key for weather data
  - `BRAVE_SEARCH_API_KEY`: Brave Search API key for location search
- Request format: Standard A2A protocol
- Response format: Standard A2A protocol

## Risk Assessment

### High Risk
- **Breaking existing agents** during base service refactor
- **Service injection complexity** causing initialization issues
- **Performance degradation** from service overhead

### Medium Risk  
- **Configuration parsing changes** affecting agent discovery
- **HTTP client reliability** for external API calls
- **Authentication security** for API credentials

### Low Risk
- **Documentation completeness**
- **Test coverage gaps**
- **Minor performance variations**

## Success Criteria

### Functional Requirements
1. **Zero Regression**: All existing agents continue working identically
2. **API Agent Integration**: Golf rules N8N agent fully functional
3. **E2E Test Pass**: Comprehensive test suite passes with new agent
4. **Performance Maintenance**: No significant performance degradation

### Architectural Requirements
1. **Service Decomposition**: A2AAgentBaseService reduced to <200 lines
2. **Single Responsibility**: Each service has clear, focused purpose
3. **Extensibility**: Architecture ready for ExternalA2AAgentBaseService
4. **Maintainability**: Simplified testing and debugging

### Operational Requirements
1. **Backward Compatibility**: Existing deployments unaffected
2. **Configuration Management**: Environment variables properly handled
3. **Error Handling**: Graceful degradation for API failures
4. **Security**: API credentials properly secured

## Future Considerations

### ExternalA2AAgentBaseService
- Similar file-based configuration approach
- A2A protocol client implementation
- Agent capability discovery
- Load balancing and failover

### Agent Management UI
- Dynamic agent configuration
- Runtime agent registration
- Performance monitoring dashboard
- Configuration validation tools

### Scalability Enhancements
- Agent caching and pooling
- Distributed agent discovery
- Load balancing across agent instances
- Horizontal scaling support

## Conclusion

This refactor addresses critical architectural debt while adding new capabilities. The decomposed service architecture provides a solid foundation for future agent types and maintains the simplicity of the file-based configuration approach that has proven effective.

The phased approach minimizes risk by validating stability before changes and incrementally building new capabilities. Success depends on maintaining comprehensive test coverage and ensuring zero regression for existing functionality. 
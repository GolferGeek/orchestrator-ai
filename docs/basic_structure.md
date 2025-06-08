# Basic Agent Structure - Initial Thoughts

## Current State Analysis

### Existing Agent Architecture

Our current agent system has three main architectural layers:

1. **`A2AAgentBaseService`** (Foundation Layer)
   - Abstract base class defining the A2A protocol
   - Handles task lifecycle (receive, status, cancel)
   - Requires concrete implementation of `process_message()` method
   - Location: `apps/api/fastapi/a2a_protocol/base_agent.py`

2. **`MCPContextAgentBaseService`** (Pattern Layer)
   - Specialized base class for agents that proxy to MCP backend services
   - Implements `process_message()` by forwarding queries to MCP target agents
   - Currently loads context from centralized `shared/markdown_context/` directory
   - Location: `apps/api/fastapi/agents/base/mcp_context_agent_base.py`

3. **`OrchestratorService`** (Complex Agent Example)
   - Sophisticated agent with custom `process_message()` implementation
   - Uses LLM for routing decisions and maintains conversation history
   - Discovers and delegates to other agents dynamically
   - Location: `apps/api/fastapi/agents/orchestrator/main.py`

### Current Agent Example: MetricsService

The `MetricsService` demonstrates the current simplified pattern:
- Inherits from `MCPContextAgentBaseService`
- Defines configuration through class attributes
- No custom `process_message()` implementation needed
- Context file stored in centralized location
- Location: `apps/api/fastapi/agents/business/metrics/main.py`

## Identified Problems

### 1. Context File Location Issues
- Context files are stored in a centralized `shared/markdown_context/` directory
- Creates separation between agent logic and its knowledge base
- Requires naming convention coordination between agent and central service
- Reduces modularity and increases cognitive load for developers

### 2. Limited Agent Development Patterns
- Only two patterns currently available:
  - Complex custom agents (like Orchestrator)
  - MCP proxy agents (like Metrics)
- No simple pattern for basic function-based agents
- High barrier to entry for new agent developers

### 3. Coupling and Maintenance Issues
- Agent behavior scattered across multiple directories
- Brittle dependency on central naming conventions
- Difficult to package agents as self-contained modules

## Proposed Solutions

### 1. Co-locate Context Files

**Problem Solved**: Move context files from centralized storage to agent directories.

**Change**: Instead of `shared/markdown_context/metrics_agent.md`, store context as `agents/business/metrics/context.md` (or similar naming).

**Benefits**:
- **Encapsulation**: Agent becomes truly self-contained unit
- **Developer Experience**: Everything related to an agent in one location
- **Reduced Brittleness**: Explicit relative path relationships vs. naming conventions
- **Scalability**: Avoids central "junk drawer" as agent count grows

### 2. Create SimpleFunctionalAgentBase

**Problem Solved**: Provide easy pattern for basic custom logic agents.

**Proposed Architecture**:
```python
class SimpleFunctionalAgentBase(A2AAgentBaseService):
    def __init__(self, agent_logic_func, **kwargs):
        super().__init__(**kwargs)
        self.agent_logic_func = agent_logic_func
    
    async def process_message(self, message: Message, **kwargs) -> Message:
        user_query = message.parts[0].root.text
        response_text = self.agent_logic_func(user_query)
        return self._create_text_message(response_text)
```

**Agent Structure**:
```
agents/category/agent_name/
├── main.py              # Configuration and dependency injection
├── agent_function.py    # Pure business logic
└── context.md          # Knowledge base (for MCP agents)
```

**Benefits**:
- **Separation of Concerns**: Protocol vs. configuration vs. business logic
- **Testability**: Pure functions easy to unit test
- **Onboarding**: New developers only need to learn Python functions
- **Flexibility**: Can wrap any synchronous or asynchronous function

## Proposed Agent Development Patterns

### Pattern 1: MCP Context Agent (Improved)
For agents that need to query backend knowledge services:

```python
# main.py
class MyMCPAgent(MCPContextAgentBaseService):
    agent_name = "my_agent"
    mcp_target_agent_id = "my_agent"
    context_file_path = Path(__file__).parent / "context.md"  # Co-located
```

### Pattern 2: Simple Functional Agent (New)
For agents with custom logic:

```python
# main.py
from .agent_function import my_agent_logic

def get_agent_service(...):
    return SimpleFunctionalAgentBase(
        agent_logic_func=my_agent_logic,
        agent_name="My Agent"
    )

# agent_function.py
def my_agent_logic(query: str) -> str:
    # Pure business logic here
    return f"Processed: {query}"
```

### Pattern 3: Complex Custom Agent (Existing)
For sophisticated agents like the Orchestrator:

```python
# main.py
class ComplexAgent(A2AAgentBaseService):
    async def process_message(self, message, **kwargs):
        # Custom complex logic here
        pass
```

## Implementation Plan

### Phase 1: Improve MCP Context Pattern
1. Modify `MCPContextAgentBaseService` to support co-located context files
2. Update `MetricsService` to use local context file
3. Move existing context files to agent directories
4. Test existing MCP agents work with new pattern

### Phase 2: Create Simple Functional Pattern
1. Implement `SimpleFunctionalAgentBase` class
2. Create demo "Echo Agent" using new pattern
3. Document both patterns for future developers
4. Create agent scaffolding/template tools

### Phase 3: Developer Experience Improvements
1. Create agent generator CLI tools
2. Standardize agent directory structures
3. Improve testing patterns for both agent types
4. Update documentation and examples

## Expected Benefits

### For Agent Developers
- **Faster Development**: Clear patterns with minimal boilerplate
- **Easier Debugging**: All agent code in one location
- **Better Testing**: Pure functions easy to test in isolation
- **Clear Separation**: Protocol, configuration, and logic clearly separated

### For System Architecture
- **Modularity**: Self-contained agent modules
- **Scalability**: Patterns that scale to hundreds of agents
- **Maintainability**: Explicit dependencies and relationships
- **Flexibility**: Multiple patterns for different use cases

### For Team Productivity
- **Lower Barrier to Entry**: New developers can focus on business logic
- **Consistent Structure**: Predictable organization across all agents
- **Faster Onboarding**: Clear examples and patterns to follow
- **Reduced Coupling**: Agents are more independent and portable

## Questions for Further Discussion

1. Should we maintain backward compatibility during migration?
2. What naming conventions should we use for context files?
3. Should we create CLI tools for agent scaffolding?
4. How should we handle agents that need both MCP and custom logic?
5. What testing patterns should we recommend for each agent type?

---

*This document captures initial architectural thoughts for improving our agent development framework. It should be updated as we implement and refine these ideas.* 
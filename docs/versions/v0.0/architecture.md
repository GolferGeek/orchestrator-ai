# Orchestrator AI v0.0 Architecture

This document outlines the architecture of the Orchestrator AI system at v0.0 release.

## System Overview

```
                 ┌───────────────┐
                 │   User API    │
                 │    Request    │
                 └───────┬───────┘
                         ▼
               ┌─────────────────┐
               │  Orchestrator   │◄────┐
               │      Agent      │     │
               └────────┬────────┘     │
                        │              │
                        ▼              │
        ┌──────────────────────────┐   │
        │ OpenAI Service (Routing) │   │
        └──────────────┬───────────┘   │
                       │               │
                       ▼               │
┌──────────────────────────────────────┴───────────────────────┐
│                                                               │
│  ┌─────────────┐   ┌─────────────┐    ┌─────────────┐        │
│  │  Metrics    │   │ Blog Post   │    │  Other      │        │
│  │   Agent     │   │   Agent     │    │  Agents     │        │
│  └──────┬──────┘   └──────┬──────┘    └──────┬──────┘        │
│         │                 │                   │               │
│         ▼                 ▼                   ▼               │
│  ┌─────────────┐   ┌─────────────┐    ┌─────────────┐        │
│  │   Metrics   │   │  Blog Post  │    │   Other     │        │
│  │   Context   │   │   Context   │    │   Context   │        │
│  └─────────────┘   └─────────────┘    └─────────────┘        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Orchestrator Agent
- **Purpose**: Central decision-making agent that routes user queries to appropriate specialized agents
- **Location**: `apps/api/agents/orchestrator/`
- **Key Functions**:
  - Analyzes user input via LLM
  - Discovers and maintains a registry of all available agents
  - Routes requests to appropriate agents
  - Returns responses to the user

### 2. Specialized Agents
- **Purpose**: Handle domain-specific tasks and queries
- **Location**: `apps/api/agents/{category}/{agent_name}/`
- **Key Agents**:
  - Metrics Agent: `apps/api/agents/business/metrics/`
  - Blog Post Agent: `apps/api/agents/marketing/blog_post/`
  - Others in various domains

### 3. Markdown Context System
- **Purpose**: Knowledge base for each agent
- **Location**: `markdown_context/`
- **Implementation**: Each agent has a corresponding file (e.g., `metrics_agent.md`)

### 4. MCP (Message Control Program)
- **Purpose**: Shared system for context processing and LLM interactions
- **Location**: `apps/api/shared/mcp/`
- **Key Functions**:
  - Context loading from markdown files
  - Prompt construction
  - LLM API calls
  - Response formatting

### 5. A2A Protocol
- **Purpose**: Standardized communication protocol between agents
- **Location**: `apps/api/a2a_protocol/`
- **Key Components**:
  - Task definition
  - Message format
  - Task store for persistence

## API Endpoints

### Main API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agents/orchestrator/tasks` | POST | Send a task to the orchestrator |
| `/agents/orchestrator/tasks/{task_id}` | GET | Check the status of a task |
| `/agents/{category}/{agent}/tasks` | POST | Send a task directly to a specialized agent |
| `/agents/{category}/{agent}/agent-card` | GET | Get metadata about an agent |

## Data Flow

1. User sends a request to the orchestrator
2. Orchestrator uses LLM to analyze request and determine routing
3. Orchestrator forwards the request to the appropriate specialized agent
4. Specialized agent loads its markdown context
5. Specialized agent processes the request using its context and LLM
6. Response is returned to the orchestrator
7. Orchestrator returns the final response to the user

## Dependencies

- **FastAPI**: Web framework
- **OpenAI API**: LLM provider
- **Pydantic**: Data validation
- **HTTPX**: Async HTTP client

## Configuration

Environment variables (`.env` file):
- `OPENAI_API_KEY`: API key for OpenAI
- `ENVIRONMENT`: development/production
- `LOG_LEVEL`: Logging verbosity
- `PORT`: API port (default: 8000)

## Future Architecture Considerations

- Adding vector databases for larger knowledge bases
- Implementing more complex inter-agent communication patterns
- Adding a web UI for easier interaction
- Enhancing security and authentication 
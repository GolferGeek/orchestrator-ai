# Agent Base Services

This directory contains all the foundational services for the A2A Agent Framework.

## Architecture Overview

```
services/
├── base-services/          # Core inheritance services
│   ├── a2a-base/          # Base A2A protocol implementation
│   ├── context/       # MCP context agent base service
│   ├── agent-function/    # Function-based agent base service
│   └── index.ts           # Exports for base services
├── registry/              # Agent registration and discovery
├── auth/                  # Authentication and authorization
├── validation/            # Request/response validation
├── logging/               # Structured logging and monitoring
├── config/                # Configuration management
└── health/                # Health checks and monitoring
```

## Service Categories

### Base Services (Ready)
Core inheritance services that provide the foundation for all agent types:
- **A2AAgentBaseService**: JSON-RPC protocol and agent card generation
- **ContextAgentBaseService**: Markdown context loading and processing
- **AgentWithFunctionBaseService**: Function registration and execution

### Utility Services (Planned)
Supporting services that will be implemented in future tasks:
- **Registry**: Agent registration, discovery, and dependency management
- **Auth**: Authentication, authorization, and security enforcement
- **Validation**: JSON-RPC validation, schema enforcement, input sanitization
- **Logging**: Structured logging, audit trails, performance metrics
- **Config**: Configuration management and environment handling
- **Health**: Health monitoring, status reporting, automated recovery

## Usage

Import base services for agent implementation:
```typescript
import { 
  A2AAgentBaseService, 
  ContextAgentBaseService, 
  AgentWithFunctionBaseService 
} from './base-services';
```

Utility services will be available once implemented in their respective directories. 
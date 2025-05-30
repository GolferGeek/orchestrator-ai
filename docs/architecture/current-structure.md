# Current Architecture: Working Multi-Version API Structure

**Status: ✅ IMPLEMENTED & WORKING**  
**Last Updated: 2025-05-30**

## Overview

We have successfully implemented a clean, scalable multi-version API architecture that supports both V1 (stable legacy) and V2 (A2A protocol compliant) implementations running simultaneously.

## Current Directory Structure

```
apps/
├── api/
│   ├── v1/
│   │   └── fastapi/                    # Port 8000 - Stable Legacy API
│   │       ├── agents/                 # Business logic agents
│   │       ├── core/                   # Core configurations  
│   │       ├── a2a_protocol/           # Independent V1 contracts
│   │       ├── main.py                 # FastAPI application
│   │       ├── pyproject.toml          # PDM dependencies
│   │       └── Dockerfile              # Container configuration
│   └── v2/
│       ├── fastapi/                    # Port 8001 - A2A Protocol Compliant
│       │   ├── agents/                 # Hierarchical agent structure
│       │   │   ├── system/orchestrator/    # Core orchestration
│       │   │   ├── business/metrics/        # Metrics analysis
│       │   │   └── marketing/blog_post/     # Content generation
│       │   ├── a2a_protocol/           # A2A implementation
│       │   ├── shared/mcp/             # Model Context Protocol
│       │   ├── main.py                 # FastAPI application
│   │   │   ├── pyproject.toml          # PDM dependencies
│   │   └── Dockerfile              # Container configuration
│   └── shared/
│       ├── contracts/              # OpenAPI v3 specifications
│       ├── generated/
│       │   ├── python/             # Generated Pydantic models
│       │   └── typescript/         # Generated TypeScript types
│       └── docs/                   # API documentation
├── web/                                # Vue.js frontend
│   ├── src/
│   │   ├── services/clients/           # API client abstraction
│   │   └── components/ApiSelector.vue  # Version switching UI
│   └── package.json
└── scripts/                            # Development tools
```

## Docker Commands

The following npm scripts are available for Docker operations:

### Build Commands
```bash
# Build both V1 and V2 API containers
npm run docker:build

# Build individual containers
npm run docker:build:v1    # Builds orchestrator-v1-api image
npm run docker:build:v2    # Builds orchestrator-v2-api image
```

### Run Commands  
```bash
# Run both V1 and V2 API containers
npm run docker:run

# Run individual containers (detached mode)
npm run docker:run:v1      # Runs on port 8000
npm run docker:run:v2      # Runs on port 8001
```

### Management Commands
```bash
# View container logs
npm run docker:logs:v1     # Follow V1 API logs
npm run docker:logs:v2     # Follow V2 API logs

# Stop containers
npm run docker:stop        # Stop both containers
npm run docker:stop:v1     # Stop V1 container only
npm run docker:stop:v2     # Stop V2 container only

# Clean up (stop containers and remove images)
npm run docker:clean
```

### Container Details
- **V1 API Container**: `orchestrator-v1` (port 8000)
- **V2 API Container**: `orchestrator-v2` (port 8001)  
- **Images**: `orchestrator-v1-api` and `orchestrator-v2-api`
- **Auto-remove**: Containers use `--rm` flag for automatic cleanup on stop

## Key Achievements

### ✅ **Working V1 API (Port 8000)**
- **Status**: Stable and fully functional
- **Contracts**: Independent, self-contained
- **Architecture**: Battle-tested patterns
- **Frontend Integration**: Full compatibility

### ✅ **Working V2 API (Port 8001)**
- **Status**: Production-ready with A2A compliance
- **Contracts**: Shared OpenAPI specifications
- **Architecture**: Hierarchical agent delegation
- **Features**:
  - Agent orchestration with proper delegation
  - MCP (Model Context Protocol) integration
  - A2A-compliant response format with `output_artifacts`
  - Proper agent attribution in responses
  - Task delegation between specialized agents

### ✅ **Frontend API Switching**
- **Status**: Seamless switching between V1 and V2
- **Features**:
  - API selector component in top-right corner
  - Runtime switching without page reload
  - Version-specific response parsing
  - Visual indication of current API version

### ✅ **Container & Development Support**
- **Docker**: Both APIs containerized with PDM
- **Scripts**: npm scripts for both versions
- **Environments**: Support for dev, test, prod
- **Task Management**: Task Master integration

## API Comparison

| Feature | V1 API | V2 API |
|---------|--------|--------|
| **Port** | 8000 | 8001 |
| **Protocol** | Custom | A2A Compliant |
| **Agent Structure** | Flat | Hierarchical |
| **Response Format** | Custom | `output_artifacts` |
| **Agent Delegation** | Direct | Orchestrator-mediated |
| **Contracts** | Independent | Shared OpenAPI |
| **MCP Integration** | ❌ | ✅ |
| **Agent Attribution** | Basic | Proper delegation tracking |

## Development Workflow

### Starting APIs
```bash
# V1 API (port 8000)
npm run dev:api:v1

# V2 API (port 8001)  
npm run dev:api:v2

# Frontend (port 5174)
npm run dev:web
```

### Testing
```bash
# V1 E2E tests
npm run test:e2e:blog-post

# Frontend tests
npm run test:web
```

### Task Management
```bash
# Current project status
npm run task:list

# Next task to work on
npm run task:next
```

## A2A Protocol Implementation (V2)

The V2 API implements the full A2A (Agent-to-Agent) protocol:

- **Task Delegation**: Orchestrator discovers and delegates to specialized agents
- **Response Format**: Standard `output_artifacts` with metadata
- **Agent Discovery**: Dynamic agent endpoint discovery
- **Error Handling**: Standardized error codes and responses
- **Agent Attribution**: Responses properly attributed to delegated agents

## Next Steps

According to Task Master, our remaining tasks are:

1. **Task #9**: Create Documentation for New Architecture *(in progress - this document)*
2. **Task #10**: Validate Final Implementation and Prepare for Production

## Success Metrics ✅

- [x] Both V1 and V2 APIs working simultaneously
- [x] Frontend can switch between APIs seamlessly  
- [x] V2 implements full A2A protocol compliance
- [x] Agent delegation working with proper attribution
- [x] MCP integration providing rich context responses
- [x] Docker containers for both versions
- [x] Clean, scalable directory structure
- [x] Development tooling and scripts updated

## Lessons Learned

1. **Version Isolation**: Keeping V1 completely independent allows safe V2 experimentation
2. **Port Separation**: Different ports (8000/8001) enable side-by-side testing
3. **Shared Contracts**: V2 shared contracts ensure consistency across implementations
4. **Hierarchical Agents**: Agent delegation pattern scales better than flat structure
5. **Frontend Abstraction**: API client abstraction enables seamless version switching

This architecture provides a solid foundation for:
- Adding new technology stacks (TypeScript/NestJS)
- Scaling agent capabilities
- Supporting multiple API versions
- Enabling customer choice in implementation preferences 
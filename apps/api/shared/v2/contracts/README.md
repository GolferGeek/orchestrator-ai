# API v2 - OpenAPI Contracts

This directory stores the OpenAPI v3 contract definitions (YAML files) for the A2A (Agent-to-Agent) v2 protocol.

These contracts serve as the single source of truth for:
- Data structures
- Message formats
- Agent capabilities
- Common types used across the v2 API.

## Files

- `common-types.yaml`: Defines shared primitive types, error structures, and reusable parameters/responses used across all v2 API contracts.
- `agent-types.yaml`: Specifies the structure for agent metadata, capabilities, and discovery formats (e.g., AgentCard).
- `a2a-protocol.yaml`: Contains the core definitions for the Agent-to-Agent communication protocol, including message passing, task management, and artifact exchange formats.

These files are designed to be inter-referenced (e.g., `a2a-protocol.yaml` and `agent-types.yaml` both reference `common-types.yaml`).

Tooling can be used to validate these contracts and generate server/client code for different languages (see the `../generated/` directory).

## Directory Structure

```
apps/api/shared/v2/contracts/
├── README.md                    # This file
├── .well-known/                 # Agent discovery configurations
├── common-types.yaml            # Shared primitives (timestamps, IDs, errors)
├── agent-types.yaml             # Agent-specific types (AgentCard, Capabilities)
├── a2a-protocol.yaml           # Core A2A types (Message, Task, Agent)
└── generated/                   # Auto-generated type files (created by generation pipeline)
    ├── python/                  # Generated Python types
    └── typescript/              # Generated TypeScript types
```

## Contract Files

### common-types.yaml
Contains shared primitive types and utilities used across all contracts:
- `UUID` - Standard UUID format
- `Timestamp` - ISO 8601 timestamp format
- `ErrorCode` - Standard error code enumeration
- `JSONRPCError` - JSON-RPC error structure

### agent-types.yaml
Contains agent-specific type definitions:
- `AgentCard` - Agent metadata and capabilities
- `AgentCapability` - Individual agent capability definition
- Agent discovery format schemas

### a2a-protocol.yaml
Contains core A2A (Agent-to-Agent) protocol types:
- `Message` - Communication message structure
- `Task` - Task representation and lifecycle
- `TaskState` - Task state enumeration
- `TaskStatus` - Task status with metadata
- `Part` - Message part types (Text, Image, Artifact)

## Usage

These OpenAPI specifications serve as the **single source of truth** for type definitions shared between:

1. **FastAPI v2** (`apps/api/python/fastapi-v2/`)
2. **NestJS v2** (`apps/api/typescript/nestjs-v2/`)

### Code Generation

Types are automatically generated from these OpenAPI specs using:
- **Python**: `datamodel-codegen` → Pydantic models
- **TypeScript**: `openapi-typescript` → TypeScript interfaces

To generate all types, navigate to the `apps/api/shared/v2/` directory and run:
```bash
npm install # If you haven't already, to install devDependencies like openapi-typescript
npm run generate
```
This command executes both Python and TypeScript generation scripts defined in `apps/api/shared/v2/package.json`.

### Integration

Each implementation imports generated types:

```python
# FastAPI v2
from apps.api.shared.v2.contracts.generated.python import (
    Message, Task, AgentCard
)
```

```typescript
// NestJS v2
import { Message, Task, AgentCard } from '../../../shared/v2/contracts/generated/typescript';
```

## Versioning

- **V1 contracts**: Independent, existing in `apps/api/python/fastapi-v1/`
- **V2 contracts**: Shared between fastapi-v2 and nestjs-v2 (this directory)
- **No backward compatibility** between v1 and v2

## Development Workflow

1. **Modify contracts**: Edit `.yaml` files in this directory
2. **Generate types**: Navigate to `apps/api/shared/v2/` and run `npm run generate`
3. **Validate**: Contracts can be linted using `npm run validate` in `apps/api/shared/v2/` (this checks OpenAPI structure)
4. **Update implementations**: Both fastapi-v2 and nestjs-v2 use generated types

## Validation

All OpenAPI specs can be validated by running `npm run validate` from the `apps/api/shared/v2/` directory. This script uses Redocly CLI to lint the contract files.
- OpenAPI 3.0 schema validation
- Cross-reference validation between files
- Generated type compilation checks

## Notes

- All contracts follow OpenAPI 3.0 specification
- Cross-file references use `$ref` for type reuse
- Generated files should **never** be manually edited
- Changes to contracts require coordination between both implementations 
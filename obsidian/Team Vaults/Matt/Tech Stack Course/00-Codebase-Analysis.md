# Orchestrator AI - Codebase Deep Dive Analysis

**Status:** Draft for Discussion  
**Date:** 2025-01-12  
**Purpose:** Foundation document for tech stack course development

---

## Executive Summary

Orchestrator AI is a sophisticated **AI agent orchestration platform** built as a **Turbo monorepo** with:
- **Backend:** NestJS (TypeScript) - modular microservices architecture
- **Frontend:** Vue 3 + Ionic + Vite - mobile-first progressive web app
- **Database:** PostgreSQL via Supabase + TypeORM
- **AI/LLM:** Multi-provider support (OpenAI, Anthropic, Google, Ollama, Grok)
- **Agent System:** Database-driven agent definitions with multiple execution modes
- **Real-time:** SSE streaming for task execution updates

The platform enables organizations to:
1. Build and deploy custom AI agents
2. Orchestrate multi-agent workflows
3. Manage conversations, plans, and deliverables
4. Control data privacy (PII, pseudonymization, sovereign routing)
5. Track usage, costs, and agent performance

---

## Architecture Overview

### Monorepo Structure
```
orchestrator-ai/
├── apps/
│   ├── api/          # NestJS backend (port 9000)
│   ├── web/          # Vue + Ionic frontend (port 7101)
│   ├── n8n/          # n8n automation (Docker)
│   └── transport-types/  # Shared TypeScript types
├── scripts/          # CLI tools, utilities, testing
├── supabase/         # Local dev database + migrations
├── deployment/       # PM2, Cloudflare tunnel configs
└── docs/             # Architecture, PRDs, features
```

**Workspace Management:** Turbo handles:
- Build orchestration with dependency graphs
- Parallel task execution
- Shared configurations
- Monorepo-wide scripts (dev, build, test, lint)

---

## Backend Architecture (NestJS)

### Module Organization

The backend follows a **feature-based module structure** with clear separation of concerns:

#### Core Infrastructure Modules
1. **SupabaseModule** - Database connection, auth, RLS
2. **AuthModule** - JWT authentication, role-based guards
3. **ConfigModule** - Environment variables, feature flags
4. **HealthModule** - Health checks, readiness probes
5. **MCPModule** - Model Context Protocol integration

#### Domain Modules

##### 1. **AgentPlatformModule** (Database-Backed Agent System)
The heart of the agent infrastructure:

**Key Services:**
- `AgentRegistryService` - Agent discovery, caching (30s TTL)
- `AgentRuntimeDefinitionService` - Parse YAML → Runtime definitions
- `AgentRuntimeExecutionService` - Agent metadata management
- `AgentRuntimeDispatchService` - Request routing & dispatch
- `AgentValidationService` - Agent schema validation
- `AgentBuilderService` - Agent creation/editing
- `PlanEngineService` - Conversation planning
- `OrchestrationRunnerService` - Multi-agent orchestration
- `OrchestrationCheckpointService` - State persistence for long-running workflows

**Repositories (Supabase):**
- `AgentsRepository` - Agent definitions
- `ConversationPlansRepository` - Conversation plans
- `OrchestrationDefinitionsRepository` - Orchestration recipes
- `OrchestrationRunsRepository` - Execution history
- `OrchestrationStepsRepository` - Step-by-step tracking
- `HumanApprovalsRepository` - Human-in-the-loop gates
- `RedactionPatternsRepository` - PII patterns

**Controllers:**
- `AgentsAdminController` - CRUD for agents
- `AgentApprovalsController` - Human approval workflow
- `HierarchyController` - Agent tree structures

**Sub-modules:**
- `HierarchyModule` - Organizational agent trees
- `TasksModule` - Task management (imported from Agent2Agent)

##### 2. **Agent2AgentModule** (Execution Layer)
Handles agent-to-agent communication and execution:

**Core Services:**
- `AgentExecutionGateway` - Main entry point for all agent executions
- `AgentModeRouterService` - Routes requests to appropriate runner
- `AgentRunnerRegistryService` - Runner registration and lookup

**Agent Runners (by type):**
- `ContextAgentRunnerService` - LLM-backed agents with context
- `ToolAgentRunnerService` - MCP tool integration
- `ApiAgentRunnerService` - External API proxy
- `ExternalAgentRunnerService` - A2A protocol agents
- `OrchestratorAgentRunnerService` - Multi-step workflows
- `FunctionAgentRunnerService` - Code execution

**Sub-modules:**
- `ConversationsModule` - Conversation history
- `TasksModule` - Task lifecycle management
- `DeliverablesModule` - Generated artifacts
- `PlansModule` - Conversation planning
- `ProjectsModule` - Project management
- `ContextOptimizationModule` - Token budget optimization

**Key Services:**
- `Agent2AgentDeliverablesService` - Deliverable management
- `Agent2AgentTasksService` - Task CRUD
- `Agent2AgentConversationsService` - Conversation management

##### 3. **LLMModule** (AI Provider Layer)
Multi-provider LLM orchestration with advanced features:

**Core Services:**
- `LLMService` - Main LLM abstraction
- `LLMServiceFactory` - Provider instantiation
- `CentralizedRoutingService` - Provider selection logic
- `ProviderConfigService` - Provider configuration

**Provider Implementations:**
- `OpenAILLMService` - OpenAI (GPT models)
- `AnthropicLLMService` - Anthropic (Claude models)
- `GoogleLLMService` - Google (Gemini models)
- `OllamaLLMService` - Ollama (local models)
- `GrokLLMService` - xAI (Grok models)

**Privacy & Security:**
- `PIIService` - PII detection
- `PseudonymizationService` - Identity masking
- `DictionaryPseudonymizerService` - Dictionary-based pseudonyms
- `SecretRedactionService` - Secret detection/removal
- `SourceBlindingService` - Request origin hiding
- `BlindedLLMService` - Privacy-aware LLM calls

**Sub-modules:**
- `CIDAFMModule` - Context, Intent, Domain, Audience, Format, Modifiers
- `ProvidersModule` - Provider management
- `EvaluationModule` - Response quality evaluation
- `UsageModule` - Cost tracking
- `LangChainModule` - LangChain integration
- `SimplifiedPIIModule` - Simplified PII handling
- `SovereignPolicyModule` - Data sovereignty routing
- `ModelConfigurationModule` - Model catalog

**Controllers:**
- `LLMController` - Direct LLM access
- `LlmUsageController` - Usage analytics
- `ProductionOptimizationController` - Production tuning
- `SanitizationController` - Data sanitization

##### 4. **Additional Modules**
- `AssetsModule` - File/image management
- `WebhooksModule` - Webhook handling
- `SystemModule` - System settings
- `AnalyticsController` - Analytics endpoints

### Agent Type System

Agents are **database-backed** with YAML definitions stored in Supabase. The system supports multiple agent types:

#### Agent Types

1. **Context Agents** (Most Common)
   - LLM-backed with embedded context
   - Fetch contextual data (plans, deliverables, history)
   - Optimize context to token budget
   - Use system prompt templates

2. **Tool Agents**
   - MCP (Model Context Protocol) integration
   - Can call external tools/APIs
   - LangChain tool integration

3. **API Agents**
   - Proxy to external REST APIs
   - Request/response transformation
   - Auth handling

4. **External Agents**
   - Agent-to-Agent (A2A) protocol
   - Federated agent networks
   - Standard agent cards

5. **Orchestrator Agents**
   - Multi-step workflows
   - Checkpoint-based execution
   - Human-in-the-loop gates
   - Recipe persistence

6. **Function Agents**
   - Custom code execution
   - JavaScript/TypeScript functions

#### Agent Execution Modes

Each agent supports up to 4 execution modes:

1. **CONVERSE** - Conversational interaction
2. **PLAN** - Generate execution plans
3. **BUILD** - Create deliverables
4. **HUMAN_RESPONSE** - Human approval gate
5. **ORCHESTRATE_*** - Orchestration-specific modes (CREATE, EXECUTE, CONTINUE, SAVE_RECIPE)

#### Agent Runtime Flow

```
Request → AgentExecutionGateway
  → AgentModeRouterService
    → AgentRunnerRegistryService
      → [Specific Runner based on agent type]
        → AgentRuntimeDispatchService
          → LLMService or External Transport
            → Response normalization
              → Save to conversations/deliverables
                → Return TaskResponseDto
```

### Database Architecture (Supabase + TypeORM)

**Key Tables:**
- `agents` - Agent definitions
- `agent_orchestrations` - Orchestration mappings
- `conversation_plans` - Conversation planning
- `orchestration_definitions` - Workflow recipes
- `orchestration_runs` - Execution instances
- `orchestration_steps` - Step tracking
- `human_approvals` - Approval gates
- `redaction_patterns` - PII patterns
- `organization_credentials` - Secure credentials
- (Plus standard auth, usage, projects, deliverables, plans, tasks tables)

**Features:**
- Row-Level Security (RLS) for multi-tenancy
- TypeORM entities for type safety
- Supabase local dev environment
- Migration management
- Automated backups

---

## Frontend Architecture (Vue 3 + Ionic)

### Tech Stack
- **Framework:** Vue 3 (Composition API)
- **UI Library:** Ionic Framework v8
- **Router:** Vue Router 4 + Ionic Router
- **State:** Pinia stores
- **Build:** Vite
- **Testing:** Vitest (unit), Cypress (E2E)
- **Styling:** CSS Variables + Ionic theming

### Directory Structure

```
apps/web/src/
├── components/       # UI components
│   ├── Admin/       # Admin panels
│   ├── Analytics/   # Charts & dashboards
│   ├── Auth/        # Login/signup
│   ├── Developer/   # Dev tools
│   ├── Landing/     # Marketing pages
│   ├── LLM/         # LLM controls
│   ├── PII/         # Privacy controls
│   ├── SovereignMode/  # Data sovereignty
│   └── common/      # Shared components
├── composables/      # Reusable composition functions
├── directives/       # Vue directives (role guards)
├── router/          # Route definitions
├── services/        # API clients
│   ├── agent2agent/ # Agent services
│   └── clients/     # HTTP clients
├── stores/          # Pinia state management
├── types/           # TypeScript interfaces
├── utils/           # Helper functions
└── views/           # Page components
```

### Key Features

#### State Management (Pinia Stores)
- `authStore` - Authentication & user roles
- `agentStore` - Agent catalog
- `conversationStore` - Chat history
- `deliverableStore` - Generated artifacts
- `planStore` - Conversation plans
- `llmStore` - LLM configuration
- `sovereignPolicyStore` - Data sovereignty
- `usageStore` - Cost tracking

#### Services Layer
- `apiService` - Base API client with retry logic
- `agent2AgentConversationsService` - Agent conversations
- `agentExecutionService` - Task execution
- `deliverablesService` - Artifact management
- `llmUsageService` - Usage analytics
- `piiService` - Privacy controls
- `sovereignPolicyService` - Routing policies

#### Composables (Reusable Logic)
- `useApiSanitization` - Request sanitization
- `useDeliverables` - Deliverable management
- `useErrorHandling` - Error handling
- `useLoading` - Loading states
- `usePrivacyIndicators` - Privacy UI
- `useSovereignPolicy` - Policy management
- `useValidation` - Form validation

#### Component Patterns
- **Admin:** Settings, user management, system config
- **Analytics:** Charts, dashboards, usage reports
- **LLM:** Model selection, CIDAFM controls
- **PII:** Privacy indicators, redaction controls
- **Landing:** Marketing pages, demos

---

## Key Technologies Deep Dive

### 1. Turbo Monorepo
**Purpose:** Efficient monorepo management

**Features:**
- Dependency graph computation
- Intelligent caching
- Parallel task execution
- Workspace isolation
- Global dependencies

**Configuration:** `turbo.json`
```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### 2. NestJS
**Purpose:** Scalable Node.js backend framework

**Key Concepts:**
- **Modules:** Feature encapsulation
- **Providers:** Injectable services
- **Controllers:** HTTP request handlers
- **Guards:** Auth & authorization
- **Interceptors:** Request/response transformation
- **Pipes:** Input validation
- **Exception Filters:** Error handling

**Patterns Used:**
- Dependency Injection
- Decorator-based routing
- Module-based architecture
- Repository pattern
- Factory pattern

### 3. Vue 3 + Composition API
**Purpose:** Reactive, component-based UI

**Key Features:**
- Reactivity system (`ref`, `reactive`, `computed`)
- Composition API for logic reuse
- SFC (Single File Components)
- TypeScript support
- Teleport, Suspense

### 4. Ionic Framework
**Purpose:** Mobile-first UI components

**Features:**
- Cross-platform components
- Native gestures
- Dark mode support
- Capacitor integration (mobile)
- Responsive design

### 5. Pinia
**Purpose:** Vue state management

**Advantages over Vuex:**
- Better TypeScript support
- Composition API friendly
- No mutations (only actions)
- DevTools integration

### 6. Supabase
**Purpose:** PostgreSQL-based backend-as-a-service

**Features Used:**
- PostgreSQL database
- Row-Level Security (RLS)
- Authentication (JWT)
- Realtime subscriptions
- Storage
- Local development

### 7. TypeORM
**Purpose:** TypeScript ORM for PostgreSQL

**Features:**
- Entity definitions
- Repository pattern
- Query builder
- Migrations
- Relations

### 8. LangChain
**Purpose:** LLM application framework

**Usage:**
- Tool integration
- Prompt templates
- Chain composition
- Memory management

### 9. Socket.IO → SSE Migration
**Old:** WebSocket via Socket.IO  
**New:** Server-Sent Events (SSE) for streaming

**Reason:** Simpler, more reliable for one-way streaming

---

## Agent Orchestration System

### Orchestration Architecture

**Components:**
1. **Orchestration Definitions** (Recipes)
   - Reusable workflow templates
   - Step definitions
   - Input/output schemas

2. **Orchestration Runs** (Instances)
   - Runtime execution state
   - Progress tracking
   - Checkpoint persistence

3. **Orchestration Steps**
   - Individual agent executions
   - Dependencies
   - Status tracking

4. **Checkpointing**
   - State persistence
   - Resume capability
   - Error recovery

### Orchestration Flow

```
1. User creates orchestration (or uses recipe)
2. OrchestratorAgentRunner starts execution
3. Steps execute in sequence
4. Each step:
   - Checks dependencies
   - Executes agent task
   - Saves checkpoint
   - Updates progress
5. Human gates pause for approval
6. Orchestration completes or errors
7. Results saved to deliverables
```

### Human-in-the-Loop

**Approval Gates:**
- Inserted between steps
- Pause orchestration
- Notify user
- Resume on approval/rejection
- Track approval history

---

## Privacy & Security Features

### PII Protection

1. **Detection:**
   - Pattern-based (regex)
   - Entity recognition
   - Custom dictionaries

2. **Pseudonymization:**
   - Reversible masking
   - Dictionary-based
   - User-specific mapping

3. **Redaction:**
   - Permanent removal
   - Secret detection
   - API key scanning

### Sovereign Routing

**Purpose:** Keep data within jurisdiction

**Features:**
- Geographic routing rules
- Provider-based policies
- Organization-level controls
- Model restrictions

**Example Policy:**
```json
{
  "region": "EU",
  "allowedProviders": ["anthropic"],
  "blockedModels": ["gpt-4"],
  "requiresLocalStorage": true
}
```

### Row-Level Security (RLS)

**Supabase RLS Policies:**
- User can only see their own data
- Admins can see all data
- Organization-based isolation
- Role-based access control

---

## Testing Strategy

### Backend Testing
- **Unit Tests:** Jest with NestJS testing utilities
- **E2E Tests:** Supertest for API testing
- **Coverage:** Aim for 80%+

**Test Files:**
- `*.spec.ts` - Unit tests (co-located)
- `*.e2e-spec.ts` - E2E tests (in `apps/api/testing/`)

### Frontend Testing
- **Unit Tests:** Vitest with Vue Test Utils
- **E2E Tests:** Cypress
- **Component Tests:** Vitest with jsdom

**Test Files:**
- `__tests__/*.ts` - Component tests
- `tests/unit/*.ts` - Unit tests
- `tests/integration/*.ts` - Integration tests

### Provider Testing
**Location:** `apps/api/testing/*.js`

**Tests:**
- `test-llm-recommendations.sh` - LLM routing
- `test-llm-pii-flow.sh` - PII handling
- `test-pii-pseudonym.sh` - Pseudonymization

---

## Development Workflow

### Local Development

```bash
# Start all services
npm run dev

# Start individual apps
npm run dev:api    # Backend on :9000
npm run dev:web    # Frontend on :7101

# Start Supabase
npm run dev:supabase:start

# Start n8n
npm run n8n:up
```

### Build & Deploy

```bash
# Build all
npm run build

# Test all
npm run test

# Lint & format
npm run lint
npm run format

# Production deploy
npm run server:start:production
```

### Environment Management

**Files:**
- `.env` - Root environment (API keys)
- `apps/api/.env` - API-specific config
- `apps/web/.env` - Web-specific config

**Key Variables:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
- `NODE_ENV`, `API_PORT`, `LOG_LEVEL`

---

## Advanced Features

### 1. CIDAFM Framework
**Context, Intent, Domain, Audience, Format, Modifiers**

**Purpose:** Structured prompt engineering

**Components:**
- Context: Background information
- Intent: User goal
- Domain: Subject area
- Audience: Target user
- Format: Output structure
- Modifiers: Tone, style, length

### 2. Conversation Planning
**Purpose:** Multi-turn conversation management

**Features:**
- Plan generation
- Turn tracking
- Context management
- Plan revision

### 3. Deliverables System
**Purpose:** Artifact management

**Types:**
- Documents (markdown, text)
- Data (JSON, CSV)
- Code (TypeScript, Python)
- Images (PNG, JPG)

**Features:**
- Versioning
- Metadata
- Search
- Export

### 4. Model Catalog
**Purpose:** LLM provider/model management

**Features:**
- Provider configuration
- Model capabilities
- Cost tracking
- Performance metrics

### 5. Usage Analytics
**Purpose:** Track LLM usage and costs

**Metrics:**
- Token usage (input/output)
- Cost per request
- Provider distribution
- Model usage
- Error rates

---

## Key Design Patterns

### 1. Repository Pattern
**Purpose:** Data access abstraction

**Example:**
```typescript
@Injectable()
export class AgentsRepository {
  async findBySlug(slug: string): Promise<AgentRecord | null> {
    // Supabase query
  }
}
```

### 2. Factory Pattern
**Purpose:** Object creation abstraction

**Example:**
```typescript
@Injectable()
export class LLMServiceFactory {
  create(provider: string): BaseLLMService {
    switch(provider) {
      case 'openai': return new OpenAILLMService();
      case 'anthropic': return new AnthropicLLMService();
    }
  }
}
```

### 3. Strategy Pattern
**Purpose:** Runtime algorithm selection

**Example:**
```typescript
// Different agent runners for different agent types
class ContextAgentRunnerService extends BaseAgentRunner { }
class ToolAgentRunnerService extends BaseAgentRunner { }
```

### 4. Service Layer Pattern
**Purpose:** Business logic encapsulation

**Example:**
```typescript
@Injectable()
export class AgentExecutionGateway {
  async execute(slug: string, request: TaskRequestDto): Promise<TaskResponseDto> {
    // Orchestrate execution
  }
}
```

### 5. DTO Pattern
**Purpose:** Data transfer objects

**Example:**
```typescript
export class TaskRequestDto {
  mode: AgentTaskMode;
  content: string;
  metadata?: Record<string, any>;
}
```

---

## Notable Architectural Decisions

### 1. Database-Backed Agents
**Decision:** Store agent definitions in Supabase (not filesystem)

**Rationale:**
- Runtime updates without deployment
- Multi-tenancy support
- Version control
- RBAC integration

### 2. Multiple Agent Types
**Decision:** Support 6+ agent types with different execution models

**Rationale:**
- Flexibility for different use cases
- Clear separation of concerns
- Extensibility

### 3. Mode-Based Execution
**Decision:** CONVERSE/PLAN/BUILD instead of single execution path

**Rationale:**
- Clear intent separation
- Different LLM strategies
- Better user experience

### 4. Monorepo Structure
**Decision:** Single repo with multiple apps

**Rationale:**
- Shared types
- Atomic changes
- Simplified CI/CD
- Better collaboration

### 5. Privacy-First Design
**Decision:** PII detection, pseudonymization, sovereign routing built-in

**Rationale:**
- Enterprise requirements
- Regulatory compliance
- User trust

---

## Learning Path Recommendations

### Beginner (Intern Day 1)
1. Understand monorepo structure
2. Set up local development
3. Explore agent catalog UI
4. Create a simple context agent
5. Run agent in CONVERSE mode

### Intermediate (Week 1-2)
1. Understand NestJS modules
2. Explore agent runtime services
3. Create custom agent types
4. Build Vue components
5. Integrate with LLM providers

### Advanced (Month 1+)
1. Orchestration system deep dive
2. Privacy & security features
3. Custom tool integration
4. Performance optimization
5. Testing strategies

---

## Discussion Questions for Matt

### Architecture
1. Is my understanding of the agent type system correct?
2. Are there any major architectural decisions I missed?
3. What's the current state of the orchestration checkpoint system?

### Tech Stack
4. Are there any upcoming technology migrations planned?
5. Which areas of the codebase need the most documentation?
6. Are there any "gotchas" I should highlight for interns?

### Course Structure
7. What level of depth for each technology (overview vs deep dive)?
8. Should I focus more on agent authoring or platform internals?
9. Are there specific patterns you want emphasized?

### Current Development
10. What features are in active development?
11. Which modules are most stable vs most volatile?
12. Any deprecated patterns to avoid teaching?

---

## Next Steps

1. **Matt Reviews & Corrects** - Please annotate this doc with corrections
2. **Clarification Discussion** - Address any questions above
3. **Create Course Outline** - Based on corrected understanding
4. **Build Progressive Learning Modules** - From beginner to advanced
5. **Develop Hands-On Labs** - Practical exercises for each level

---

**End of Analysis Document**


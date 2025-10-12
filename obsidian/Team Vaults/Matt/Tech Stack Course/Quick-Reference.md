# Orchestrator AI - Quick Reference Guide

**Last Updated:** 2025-01-12

---

## One-Sentence Description

**Orchestrator AI** is a multi-tenant AI agent orchestration platform that enables organizations to build, deploy, and manage custom AI agents with advanced privacy controls, multi-provider LLM support, and enterprise-grade orchestration capabilities.

---

## Tech Stack at a Glance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Monorepo** | Turbo | Workspace management, build orchestration |
| **Backend** | NestJS + TypeScript | API server, business logic |
| **Frontend** | Vue 3 + Ionic + Vite | Progressive web app |
| **Database** | PostgreSQL + Supabase | Data persistence, auth, RLS |
| **ORM** | TypeORM | Database abstraction |
| **State** | Pinia | Vue state management |
| **AI/LLM** | LangChain + Multi-provider | OpenAI, Anthropic, Google, Ollama, Grok |
| **Testing** | Jest, Vitest, Cypress | Unit, integration, E2E |
| **Deployment** | PM2 + CloudFlare Tunnel | Process management, networking |

---

## Core Modules (Backend)

```
AppModule
├── AgentPlatformModule       # Agent definitions, registry, orchestration
├── Agent2AgentModule          # Agent execution, runners, conversations
├── LLMModule                  # Multi-provider LLM with privacy features
├── SupabaseModule             # Database, auth, RLS
├── AuthModule                 # JWT, role-based access
├── MCPModule                  # Model Context Protocol
└── AssetsModule               # File/image storage
```

---

## Agent Type System

| Agent Type | Purpose | Example Use Case |
|------------|---------|------------------|
| **Context** | LLM + embedded context | Requirements writer, analyst |
| **Tool** | MCP tool integration | Search, calculator, API calls |
| **API** | External REST proxy | CRM integration, data fetch |
| **External** | A2A protocol | Federated agent networks |
| **Orchestrator** | Multi-step workflows | Complex business processes |
| **Function** | Code execution | Data transformation, validation |

---

## Execution Modes

| Mode | Purpose | Output |
|------|---------|--------|
| **CONVERSE** | Chat interaction | Conversational response |
| **PLAN** | Generate plan | Structured plan object |
| **BUILD** | Create deliverable | Document, code, data |
| **HUMAN_RESPONSE** | Approval gate | Pause for human input |

---

## Key Directories

```
apps/
├── api/src/
│   ├── agent-platform/      # Agent infrastructure
│   ├── agent2agent/         # Execution layer
│   ├── llms/               # LLM providers & privacy
│   ├── auth/               # Authentication
│   ├── supabase/           # DB client
│   └── mcp/                # MCP integration
│
└── web/src/
    ├── components/         # Vue components
    ├── stores/            # Pinia state
    ├── services/          # API clients
    ├── composables/       # Reusable logic
    └── views/             # Pages
```

---

## Data Flow (Simplified)

```
User Request
  → AgentExecutionGateway
    → AgentModeRouterService
      → [ContextAgentRunner | ToolAgentRunner | ApiAgentRunner...]
        → LLMService (if LLM-backed)
          → Privacy Layer (PII, redaction, pseudonymization)
            → Provider (OpenAI, Anthropic, etc.)
              → Response Processing
                → Save to DB (conversations/deliverables)
                  → Return to User
```

---

## Privacy & Security Layers

1. **PII Detection** - Pattern-based entity recognition
2. **Pseudonymization** - Reversible identity masking
3. **Redaction** - Permanent removal of secrets
4. **Sovereign Routing** - Geographic data control
5. **Row-Level Security** - Multi-tenant isolation
6. **Role-Based Access** - User/admin permissions

---

## Development Commands

```bash
# Setup
npm install
npm run dev:supabase:start

# Development
npm run dev              # All services
npm run dev:api          # Backend only (port 9000)
npm run dev:web          # Frontend only (port 7101)

# Build & Test
npm run build            # Build all workspaces
npm run test             # Run all tests
npm run lint             # Lint all code

# Database
npm run dev:supabase:reset   # Reset DB
npm run dev:supabase:status  # Check status

# Production
npm run server:start:production
npm run server:status
npm run server:stop
```

---

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| API | 9000 | http://localhost:9000 |
| Web | 7101 | http://localhost:7101 |
| Supabase | 54321 | http://localhost:54321 |
| n8n | 5678 | http://localhost:5678 |

---

## Key Environment Variables

```bash
# Database
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# LLM Providers
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...

# Application
NODE_ENV=development
API_PORT=9000
LOG_LEVEL=error,warn
```

---

## Common Patterns

### Creating an Agent (Context Type)
```yaml
metadata:
  name: "My Agent"
  type: "context"
description: "Does something useful"
input_modes: [application/json]
output_modes: [text/markdown]

llm:
  provider: anthropic
  model: claude-3-5-sonnet

prompts:
  system: "You are a helpful agent..."

execution_profile: "conversation_only"
```

### Making an Agent Request (Frontend)
```typescript
const response = await agentExecutionService.executeTask(
  'my-agent-slug',
  {
    mode: 'CONVERSE',
    content: 'Hello, agent!',
    metadata: { userId: user.id }
  }
);
```

### Backend Service Pattern
```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly repository: MyRepository,
    private readonly logger: Logger,
  ) {}

  async doSomething(): Promise<Result> {
    // Business logic
  }
}
```

---

## Testing Patterns

### Backend Unit Test
```typescript
describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MyService, MockRepository],
    }).compile();
    service = module.get(MyService);
  });

  it('should do something', async () => {
    const result = await service.doSomething();
    expect(result).toBeDefined();
  });
});
```

### Frontend Component Test
```typescript
describe('MyComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(MyComponent);
    expect(wrapper.text()).toContain('Expected text');
  });
});
```

---

## Architecture Principles

1. **Database-Driven Agents** - Agents live in DB, not filesystem
2. **Privacy by Design** - PII/pseudonymization built-in
3. **Multi-Tenancy** - Organization-based isolation
4. **Provider Agnostic** - Support multiple LLM providers
5. **Modular Design** - Feature-based modules
6. **Type Safety** - TypeScript everywhere
7. **Testability** - Dependency injection, mocking

---

## Learning Path

### Level 1: Setup & Basics
- Clone repo, install dependencies
- Start local development
- Explore agent catalog
- Create simple context agent
- Test in CONVERSE mode

### Level 2: Understanding Flow
- Trace request through gateway
- Understand agent types
- Explore LLM module
- Build custom agent
- Add to Vue frontend

### Level 3: Advanced Features
- Orchestration system
- Privacy features
- Custom tools (MCP)
- Performance optimization
- Production deployment

---

## Resources

- **Main Analysis:** `00-Codebase-Analysis.md` (full details)
- **Code:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai`
- **API Docs:** http://localhost:9000/api/docs (when running)
- **Agent Types:** `/docs/agent-types/`
- **PRDs:** `/docs/prd/`

---

**Need Help?**
- Check `00-Codebase-Analysis.md` for deep dives
- Review agent type docs in `/docs/agent-types/`
- Explore example agents in Supabase
- Ask Matt! 🚀


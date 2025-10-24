# High-Level Vision: Database-Driven Agent Platform

## Executive Summary
Transform orchestrator-ai from a file-based agent system to a fully dynamic, database-driven agent platform that enables users to create, manage, and orchestrate AI agents through a unified interface. This platform will support multiple agent types (context, conversation-only, API, function, orchestrator) with complete lifecycle management from creation to execution to orchestration.

## The Big Picture

### What We're Building
A **unified AI agent platform** where:
- Users can create custom agents via UI (Agent Builder)
- Agents are stored in database (not YAML files)
- Agents execute through multiple modes (converse, plan, build)
- Orchestrators coordinate multiple specialist agents
- Everything is dynamic - no code deploys for new agents

### Why This Matters
**Current State (File-Based):**
- Agents defined in YAML files
- Requires code deployment for new agents
- Hard to customize or extend
- Dual systems (file + database) causing confusion
- Complex routing logic

**Future State (Database-Driven):**
- Agents created through UI
- Instant availability (no deployment)
- User-customizable
- Single, clean architecture
- Orchestration enables complex workflows

## Core Principles

### 1. Database as Source of Truth
- All agent definitions in database
- Configuration, prompts, capabilities stored as data
- Dynamic loading at runtime
- Version control through database records

### 2. Agent Types Diversity
Support multiple agent architectures:
- **Context Agents:** LLM-based, create deliverables
- **Conversation-Only:** Chat-based, no outputs
- **Function Agents:** Execute code, deterministic
- **API Agents:** Delegate to external services (n8n)
- **Orchestrators:** Coordinate other agents

### 3. Progressive Enhancement
Build capabilities in phases:
- Start simple (context agents)
- Add conversation-only support
- Enable API delegation
- Culminate in orchestration

### 4. Clean Architecture
- Single code path (no dual systems)
- Clear separation of concerns
- Agent2Agent protocol for backend
- Unified stores/services on frontend

### 5. User Empowerment
- Agent Builder UI for creation
- Draft → Review → Activate workflow
- Users control their agent ecosystem
- No technical knowledge required

## Key Capabilities

### Agent Lifecycle
```
Create (Agent Builder)
  ↓
Review (Draft state)
  ↓
Activate (Make available)
  ↓
Execute (Users interact)
  ↓
Monitor (Usage, performance)
  ↓
Update (Iterate, improve)
  ↓
Archive (Sunset old agents)
```

### Execution Modes
Different interaction patterns:
- **Converse:** Back-and-forth dialogue
- **Plan:** Generate outline/strategy
- **Build:** Create deliverable
- **Orchestrate:** Multi-agent workflow

### Deliverables Management
- Text documents (markdown)
- Images (via API agents)
- Plans (structured outlines)
- Orchestration results (aggregated outputs)
- Version history
- LLM reruns (try different models)

### Orchestration Workflows
- Multi-step plans
- Specialist delegation
- Result aggregation
- Nested sub-orchestrations
- Reusable recipes/capabilities

## Agent Types Deep Dive

### Context Agents
**Purpose:** Create content/deliverables with LLM

**Examples:** blog_post_writer, social_media_manager, email_writer

**Flow:**
1. User converses about requirements
2. Agent generates plan/outline
3. User approves plan
4. Agent builds deliverable
5. User can edit or rerun with different LLM

**Key Features:**
- Planning mode
- Build mode
- Deliverables with versions
- LLM rerun capability

### Conversation-Only Agents
**Purpose:** Provide information, answer questions

**Examples:** hr_agent, customer_support, advisor

**Flow:**
1. User asks questions
2. Agent responds
3. Ongoing dialogue
4. No deliverables created

**Key Features:**
- Converse mode only
- No planning or building
- Conversation history
- Simple interface

### Function Agents
**Purpose:** Execute code, deterministic operations

**Examples:** image_generator, data_processor, calculator

**Flow:**
1. User provides input
2. Agent executes function code
3. Returns result
4. Can create deliverable

**Key Features:**
- JavaScript/TypeScript execution
- Stored in function_code column
- Deterministic (same input = same output)
- Fast execution

### API Agents
**Purpose:** Delegate to external services

**Examples:** metrics_agent, marketing_swarm, requirements_writer

**Flow:**
1. User makes request
2. Agent calls webhook (n8n)
3. n8n executes workflow
4. Result returned via callback
5. Deliverable created

**Key Features:**
- Async execution
- Complex workflows in n8n
- Callback-based results
- Offloads complexity from monolith

### Orchestrator Agents
**Purpose:** Coordinate multiple specialists

**Examples:** hiverarchy_orchestrator, marketing_orchestrator, ceo_orchestrator

**Flow:**
1. User describes complex goal
2. Orchestrator creates workflow plan
3. User reviews/edits plan
4. Orchestrator executes steps sequentially
5. Each step delegates to specialist
6. Results aggregated
7. Can save as reusable recipe

**Key Features:**
- Multi-step workflows
- Specialist delegation
- Plan approval workflow
- Nested sub-orchestrations
- Recipe library

## Technical Architecture

### Backend (NestJS)
```
apps/api/src/
├── agent2agent/              # A2A protocol implementation
│   ├── controllers/          # API endpoints
│   ├── services/             # Business logic
│   │   ├── agent-conversations.service.ts
│   │   ├── agent-tasks.service.ts
│   │   ├── agent-deliverables.service.ts
│   │   ├── agent-orchestrator.service.ts
│   │   └── agent-recipes.service.ts
│   └── dto/                  # Data transfer objects
│
├── agent-platform/           # Agent management
│   ├── controllers/          # Agent CRUD, approvals
│   ├── services/             # Agent registry, runtime
│   └── repositories/         # Database access
│
├── deliverables/             # Universal deliverables API
├── llms/                     # LLM integrations
└── supabase/                 # Database layer
```

### Frontend (Vue 3)
```
apps/web/src/
├── components/
│   ├── AgentBuilder/         # Agent creation UI
│   ├── AgentTreeView.vue     # Hierarchy display
│   ├── ConversationView.vue  # Chat interface
│   ├── DeliverablesPanel.vue # For context agents
│   └── OrchestrationPane.vue # For orchestrators
│
├── stores/
│   ├── agentChatStore/       # Chat state (database agents)
│   ├── agentsStore.ts        # Agent list, hierarchy
│   └── deliverablesStore.ts  # Deliverables management
│
└── services/
    ├── agentConversationsService.ts
    ├── agentTasksService.ts
    ├── agentDeliverablesService.ts
    └── agentOrchestrationService.ts
```

### Database (Supabase/PostgreSQL)
```
Key Tables:
- agents                      # Agent definitions
- conversations               # User conversations
- tasks                       # Agent task executions
- deliverables                # Outputs/results
- deliverable_versions        # Version history
- orchestration_plans         # Workflow definitions
- orchestration_runs          # Execution tracking
- orchestration_recipes       # Reusable workflows
```

## User Personas

### Content Creator
**Needs:** Blog posts, social media content, emails

**Uses:**
- blog_post_writer (context agent)
- social_media_manager (context agent)
- email_campaign_writer (context agent)

**Journey:**
1. Start conversation about topic
2. Review plan/outline
3. Generate content
4. Edit and rerun if needed
5. Save deliverable

### Business User
**Needs:** Questions answered, information retrieved

**Uses:**
- hr_agent (conversation-only)
- customer_support (conversation-only)
- metrics_agent (API agent)

**Journey:**
1. Ask questions
2. Get answers
3. Follow-up dialogue
4. No deliverables needed

### Power User / Admin
**Needs:** Complex workflows, custom agents

**Uses:**
- Agent Builder (create custom agents)
- Orchestrators (multi-step workflows)
- Recipe library (reusable workflows)

**Journey:**
1. Create custom specialist agents
2. Configure orchestrator
3. Define workflow recipes
4. Execute complex tasks with one command

## Success Metrics

### Technical Metrics
- Agent response time < 2s
- Orchestration completion rate > 95%
- Zero downtime deployments
- Database query performance < 100ms
- Frontend bundle size < 500KB

### User Metrics
- Time to create new agent < 5 minutes
- User-created agents > 100 (first month)
- Orchestration usage > 50 runs/day
- User satisfaction > 4.5/5
- Agent execution success rate > 98%

### Business Metrics
- Reduce custom agent delivery time from weeks to minutes
- Enable non-technical users to create agents
- Support 1000+ concurrent users
- Scale to 10,000+ agents in system

## Competitive Advantages

### vs. ChatGPT
- **Specialized agents:** Tailored to specific tasks
- **Deliverables:** Structured outputs, not just chat
- **Orchestration:** Multi-agent coordination
- **Customization:** Users build their own agents

### vs. Zapier/n8n
- **AI-native:** LLM integration at core
- **Natural language:** No visual programming needed
- **Agent intelligence:** Adaptive, not just automation
- **Conversational:** Talk to agents, don't configure rules

### vs. LangChain/AutoGPT
- **User-friendly:** No coding required
- **Production-ready:** Full platform, not framework
- **Multi-tenant:** Organization support
- **Visual interface:** GUI for everything

## Risks & Mitigations

### Technical Risks
**Risk:** Database performance with 10K+ agents
**Mitigation:** Indexing, caching, query optimization

**Risk:** Orchestration execution failures
**Mitigation:** Retry logic, error handling, graceful degradation

**Risk:** LLM API rate limits
**Mitigation:** Queue system, fallback models, user feedback

### Product Risks
**Risk:** Users create low-quality agents
**Mitigation:** Validation, templates, best practices guide

**Risk:** Orchestration too complex for users
**Mitigation:** Start simple, progressive disclosure, recipes

**Risk:** Agent discovery/organization at scale
**Mitigation:** Search, tags, categories, favorites

### Business Risks
**Risk:** LLM costs too high
**Mitigation:** Efficient prompts, caching, user limits

**Risk:** Slow user adoption
**Mitigation:** Excellent onboarding, templates, examples

## Phased Rollout Strategy

### Phase 0: Aggressive Cleanup (3 days)
Remove file-based agent system, create clean foundation

### Phase 1: Context Agents (7 days)
Get deliverable workflow working end-to-end

### Phase 2: Conversation-Only (3 days)
Support simple chat agents

### Phase 3: API Agents (10 days)
Enable n8n integration for complex workflows

### Phase 4: Migration (10 days)
Migrate all demo agents to database

### Phase 5: Orchestration (22 days)
Full multi-agent workflow system

**Total Timeline: ~55 days (11 weeks)**

But with aggressive cleanup first: **~7 days to basic platform, then iterate**

## Decision Framework

When making technical decisions, prioritize:

1. **User Value:** Does this help users accomplish their goals faster?
2. **Simplicity:** Is this the simplest solution that works?
3. **Consistency:** Does this match our existing patterns?
4. **Scalability:** Will this work at 10x scale?
5. **Maintainability:** Can the team understand and maintain this?

### Example Decisions

**Should we support parallel orchestration steps?**
- User value: High (faster execution)
- Simplicity: Low (complex implementation)
- Decision: Phase 5 v2 (not v1)

**Should we rename agent2agent services?**
- User value: None (internal only)
- Simplicity: Mixed (rename is simple, but "agent2agent" is descriptive)
- Decision: Keep on backend (describes protocol), simplify on frontend

**Should we keep demo directory?**
- User value: None directly
- Simplicity: High (avoid reorganization)
- Maintainability: High (reference examples)
- Decision: Keep entire directory

## Long-Term Vision (6-12 months)

### Agent Marketplace
- Share agents across organizations
- Public agent library
- Community ratings and reviews
- Agent templates

### Advanced Orchestration
- Parallel step execution
- Conditional branching
- Human-in-the-loop approvals
- Visual workflow designer

### Multi-Modal Agents
- Image inputs/outputs
- Audio agents (speech-to-text, text-to-speech)
- Video agents
- File processing agents

### Analytics & Insights
- Agent performance dashboards
- Cost tracking per agent
- Usage patterns
- Optimization recommendations

### Enterprise Features
- SSO integration
- Fine-grained permissions
- Audit logging
- Compliance controls
- Custom LLM deployments

## Conclusion

This platform transforms AI agents from static YAML files to dynamic, user-created entities. By supporting multiple agent types and orchestration capabilities, we enable users to accomplish complex tasks through simple conversations. The phased approach ensures we build on solid foundations while moving rapidly toward the complete vision.

**The Goal:** By end of rollout, any user can create a custom agent in 5 minutes and orchestrate multiple agents to accomplish complex tasks in 1 click.

**The Path:** Start with Phase 0 cleanup, build features incrementally, ship to production in 1 week, then iterate rapidly.

**The Win:** A clean, fast, user-friendly AI agent platform that scales from simple chatbots to complex multi-agent orchestrations.

---

**Use this PRD as the North Star when making decisions during implementation.**

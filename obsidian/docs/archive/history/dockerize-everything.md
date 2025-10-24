# Dockerize Everything - AI Agent Platform in a Box

## Overview

This document outlines the plan to containerize the entire AI agent platform into a complete "drop-in template" that clients can deploy with a single `docker-compose up` command. This transforms the platform into a self-contained, production-ready AI agent system.

## Vision

**Goal**: Provide clients with a complete AI agent platform that requires zero external dependencies, zero configuration, and zero MCP knowledge.

**Client Experience**:
```bash
git clone your-ai-agent-template
cd your-ai-agent-template
docker-compose up
# ✅ Full AI agent platform running at http://localhost:5173
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                     │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Vue)     │  API (NestJS)      │  Database        │
│  Port: 5173         │  Port: 3000        │  (Supabase)      │
│                     │                    │  Port: 54321/2   │
├─────────────────────────────────────────────────────────────┤
│  AI Models (Ollama) │  MCP Services      │  Reverse Proxy   │
│  Ports: 11434-6     │  (STDIO/HTTP)      │  (Nginx)         │
│                     │                    │  Port: 80/443    │
└─────────────────────────────────────────────────────────────┘
```

## Container Breakdown

### 1. Database Layer - Supabase Container

**Purpose**: Complete PostgreSQL database with Supabase features
**Image**: `supabase/supabase:latest`

```yaml
supabase:
  image: supabase/supabase:latest
  container_name: ai-agent-database
  ports:
    - "7011:8000"   # Supabase Studio UI
    - "7012:5432"   # PostgreSQL direct access
  volumes:
    - supabase_data:/var/lib/supabase
    - ./_supabase/migrations:/docker-entrypoint-initdb.d
  environment:
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dev_password}
    POSTGRES_DB: ${POSTGRES_DB:-ai_agents}
    SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
  restart: unless-stopped
```

**Features**:
- ✅ Pre-loaded with agent schemas and sample data
- ✅ Supabase Studio for database management
- ✅ All RLS policies and triggers pre-configured
- ✅ Automatic migrations on startup

### 2. AI Models Layer - Ollama Container

**Purpose**: Local AI models for privacy and performance
**Image**: `ollama/ollama:latest`

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: ai-agent-models
  ports:
    - "11434:11434"  # Llama 3.2:3b (fast queries)
    - "11435:11435"  # Llama QwQ:32b (complex reasoning)  
    - "11436:11436"  # DeepSeek R1:7b (code generation)
  volumes:
    - ollama_models:/root/.ollama
  environment:
    OLLAMA_MODELS: "llama3.2:3b,qwq:32b,deepseek-r1:7b"
  restart: unless-stopped
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]  # Optional GPU acceleration
```

**Features**:
- ✅ Three specialized models pre-loaded
- ✅ Automatic model downloading on first start
- ✅ GPU acceleration support (optional)
- ✅ Model persistence across restarts

### 3. MCP Services Layer - Custom Container

**Purpose**: Local MCP servers for database and file operations
**Image**: Custom build from `./docker/mcp-services/`

```yaml
mcp-services:
  build: 
    context: ./docker/mcp-services
    dockerfile: Dockerfile
  container_name: ai-agent-mcp
  depends_on:
    - supabase
    - ollama
  volumes:
    - ./workspace:/app/workspace  # Client workspace access
  environment:
    DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@supabase:5432/${POSTGRES_DB}
    OLLAMA_BASE_URL: http://ollama:11434
  restart: unless-stopped
```

**Dockerfile**:
```dockerfile
FROM python:3.11-slim

# Install Node.js for mixed MCP servers
RUN apt-get update && apt-get install -y nodejs npm

# Install Python MCP servers
RUN pip install ollama-mcp-db filesystem-mcp git-mcp

# Install Node.js MCP servers  
RUN npm install -g @modelcontextprotocol/server-filesystem

# Copy startup scripts
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

CMD ["/app/startup.sh"]
```

### 4. API Layer - NestJS Container

**Purpose**: Main application API with MCP consumer services
**Image**: Custom build from `./apps/api/`

```yaml
api:
  build:
    context: ./apps/api
    dockerfile: Dockerfile
  container_name: ai-agent-api
  ports:
    - "3000:3000"
  depends_on:
    - supabase
    - ollama
    - mcp-services
  environment:
    DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@supabase:5432/${POSTGRES_DB}
    OLLAMA_BASE_URL: http://ollama:11434
    MCP_SERVICES_HOST: mcp-services
    ZAPIER_MCP_URL: ${ZAPIER_MCP_URL}
    NODE_ENV: production
  volumes:
    - ./workspace:/app/workspace
  restart: unless-stopped
```

**Features**:
- ✅ All MCP consumer services pre-configured
- ✅ Automatic agent discovery
- ✅ Health checks and monitoring
- ✅ Hot-reload for development mode

### 5. Frontend Layer - Vue Container

**Purpose**: User interface for agent interactions
**Image**: Custom build from `./apps/web/`

```yaml
web:
  build:
    context: ./apps/web
    dockerfile: Dockerfile
  container_name: ai-agent-frontend
  ports:
    - "5173:5173"
  depends_on:
    - api
  environment:
    VITE_API_URL: http://api:3000
    VITE_SUPABASE_URL: http://supabase:54321
    NODE_ENV: production
  restart: unless-stopped
```

### 6. Reverse Proxy Layer - Nginx Container

**Purpose**: Single entry point with SSL termination
**Image**: `nginx:alpine`

```yaml
nginx:
  image: nginx:alpine
  container_name: ai-agent-proxy
  ports:
    - "80:80"
    - "443:443"
  depends_on:
    - web
    - api
  volumes:
    - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
    - ./docker/nginx/ssl:/etc/nginx/ssl
  restart: unless-stopped
```

## Complete Docker Compose File

```yaml
version: '3.8'

services:
  # Database Layer
  supabase:
    image: supabase/supabase:latest
    container_name: ai-agent-database
    ports:
      - "7011"
      - "7012"
    volumes:
      - supabase_data:/var/lib/supabase
      - ./_supabase/migrations:/docker-entrypoint-initdb.d
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-ai_agents}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  # AI Models Layer
  ollama:
    image: ollama/ollama:latest
    container_name: ai-agent-models
    ports:
      - "11434:11434"
      - "11435:11435"
      - "11436:11436"
    volumes:
      - ollama_models:/root/.ollama
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MCP Services Layer
  mcp-services:
    build: ./docker/mcp-services
    container_name: ai-agent-mcp
    depends_on:
      supabase:
        condition: service_healthy
      ollama:
        condition: service_healthy
    volumes:
      - ./workspace:/app/workspace
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-dev_password}@supabase:5432/${POSTGRES_DB:-ai_agents}
      OLLAMA_BASE_URL: http://ollama:11434
    restart: unless-stopped

  # API Layer
  api:
    build: ./apps/api
    container_name: ai-agent-api
    ports:
      - "3000:3000"
    depends_on:
      - supabase
      - ollama
      - mcp-services
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-dev_password}@supabase:5432/${POSTGRES_DB:-ai_agents}
      OLLAMA_BASE_URL: http://ollama:11434
      MCP_SERVICES_HOST: mcp-services
    volumes:
      - ./workspace:/app/workspace
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend Layer
  web:
    build: ./apps/web
    container_name: ai-agent-frontend
    ports:
      - "5173:5173"
    depends_on:
      api:
        condition: service_healthy
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_SUPABASE_URL: http://localhost:54321
    restart: unless-stopped

  # Reverse Proxy Layer
  nginx:
    image: nginx:alpine
    container_name: ai-agent-proxy
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
      - api
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
    restart: unless-stopped

volumes:
  supabase_data:
  ollama_models:

networks:
  default:
    name: ai-agent-network
```

## Environment Configuration

### .env Template
```bash
# Database Configuration
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=ai_agents

# Supabase Configuration  
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# External MCP Services
ZAPIER_MCP_URL=https://api.zapier.com/v1/mcp

# AI Model Configuration
OLLAMA_MODELS=llama3.2:3b,qwq:32b,deepseek-r1:7b

# API Keys (Optional - for external services)
ANTHROPIC_API_KEY=optional_for_fallback
OPENAI_API_KEY=optional_for_fallback
```

## Directory Structure

```
ai-agent-template/
├── docker-compose.yml
├── .env.example
├── README.md
├── apps/
│   ├── api/                    # NestJS API
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   └── mcp/
│   │   │       └── services/   # MCP consumer services
│   │   └── ...
│   └── web/                    # Vue Frontend
│       ├── Dockerfile
│       └── ...
├── docker/
│   ├── mcp-services/
│   │   ├── Dockerfile
│   │   └── startup.sh
│   └── nginx/
│       ├── nginx.conf
│       └── ssl/
├── _supabase/
│   └── migrations/             # Database schema
└── workspace/                  # Client workspace (mounted)
```

## Client Benefits

### 1. Zero Setup Complexity
```bash
# Client workflow
git clone ai-agent-template my-ai-platform
cd my-ai-platform
cp .env.example .env
docker-compose up -d

# ✅ Full platform running in 2 minutes
```

### 2. Complete Feature Set
- 🤖 **3 AI Models** - Fast, reasoning, and code generation
- 🗄️ **Full Database** - PostgreSQL with Supabase features
- 🔗 **MCP Integrations** - Notion, Slack, filesystem, Git
- 🎨 **Modern UI** - Vue frontend with agent chat
- 📊 **Admin Dashboard** - Agent management and analytics

### 3. Production Ready
- ✅ **Health Checks** - All services monitored
- ✅ **SSL Support** - HTTPS out of the box
- ✅ **Data Persistence** - Volumes for all stateful data
- ✅ **Resource Limits** - Configurable for different deployments
- ✅ **Logging** - Centralized log management

### 4. Developer Friendly
- 🔧 **Hot Reload** - Development mode support
- 📝 **Documentation** - Complete setup and customization guides
- 🧪 **Testing** - Automated tests for all components
- 🔍 **Debugging** - Easy container access and logging

## Migration Cleanup Strategy

### Current Migration Analysis

**Problem**: The current `_supabase/migrations/` directory contains **24+ migration files** with:
- ❌ **Redundant tables** from early development experiments
- ❌ **Unused test data** that shouldn't be in production
- ❌ **Cleanup migrations** that cancel each other out
- ❌ **Development-specific tables** not needed for client deployments

### Essential Tables for Client Template

**Core Platform Tables** (Keep):
```sql
-- Authentication & Users
- auth.users (Supabase managed)
- public.users (user profiles)

-- Agent System
- agent_conversations (agent chat sessions)
- tasks (agent task tracking)
- sessions (chat sessions)
- messages (conversation history)

-- Metrics & KPI (Core 5 tables)
- companies (client organizations) 
- departments (organizational structure)
- kpis (key performance indicators)
- kpi_values (historical KPI data)
- kpi_targets (performance targets)

-- LLM & Evaluation
- providers (AI model providers)
- models (available AI models)
- llm_evaluations (performance tracking)
```

**Tables to Remove** (Development artifacts):
```sql
-- Remove these from client template
- mcp_* tables (old MCP tracking - being replaced)
- test_* tables (development test data)
- temp_* tables (temporary development tables)
- analytics_* tables (unused analytics experiment)
- *_backup tables (migration cleanup artifacts)
```

### Single Migration Strategy

**Goal**: Create one comprehensive `00_initial_schema.sql` that replaces all 24+ files.

**Structure**:
```sql
-- 00_initial_schema.sql
-- =====================================================
-- AI Agent Platform - Complete Initial Schema
-- =====================================================

BEGIN;

-- 1. CORE AUTHENTICATION TABLES
CREATE TABLE public.users (...);
CREATE FUNCTION public.handle_new_user() ...;
-- Auth triggers and functions

-- 2. AGENT SYSTEM TABLES  
CREATE TABLE public.sessions (...);
CREATE TABLE public.messages (...);
CREATE TABLE public.agent_conversations (...);
CREATE TABLE public.tasks (...);
-- Agent-related indexes and RLS policies

-- 3. METRICS & KPI TABLES (Essential 5)
CREATE TABLE public.companies (...);
CREATE TABLE public.departments (...);
CREATE TABLE public.kpis (...);
CREATE TABLE public.kpi_values (...);
CREATE TABLE public.kpi_targets (...);
-- KPI indexes and relationships

-- 4. LLM & EVALUATION TABLES
CREATE TABLE public.providers (...);
CREATE TABLE public.models (...);
CREATE TABLE public.llm_evaluations (...);
-- LLM tracking and evaluation

-- 5. ESSENTIAL SEED DATA
INSERT INTO providers (name, type) VALUES 
  ('Ollama', 'local'),
  ('Anthropic', 'external'),
  ('OpenAI', 'external');

INSERT INTO models (provider_id, name, type) VALUES ...;
-- Only essential seed data, no test data

-- 6. RLS POLICIES
-- Comprehensive Row Level Security policies
-- User isolation and data protection

-- 7. FUNCTIONS & TRIGGERS
-- Essential database functions
-- Automated timestamp updates
-- Data validation triggers

COMMIT;
```

### Migration Cleanup Process

#### Phase 1: Analysis & Inventory
- [ ] **Audit all 24 migration files** - Categorize tables as keep/remove
- [ ] **Identify dependencies** - Map foreign key relationships
- [ ] **Extract essential seed data** - Separate from test data
- [ ] **Document RLS policies** - Ensure security is maintained

#### Phase 2: Schema Consolidation  
- [ ] **Create consolidated schema** - Single migration file
- [ ] **Remove development artifacts** - Clean up unused tables
- [ ] **Optimize indexes** - Only include necessary indexes
- [ ] **Streamline RLS policies** - Simplified but secure policies

#### Phase 3: Validation & Testing
- [ ] **Test fresh deployment** - Verify single migration works
- [ ] **Validate agent functionality** - Ensure all agents work
- [ ] **Check MCP services** - Confirm database integration
- [ ] **Performance testing** - Verify query performance

#### Phase 4: Client Template Integration
- [ ] **Docker integration** - Include in Supabase container
- [ ] **Environment variables** - Configurable for client needs
- [ ] **Documentation** - Clear schema documentation
- [ ] **Backup strategy** - Client data protection

### Essential Tables Deep Dive

#### 1. Core Authentication (3 tables)
```sql
-- Minimal auth system
public.users              -- User profiles
auth.users               -- Supabase managed
+ auth triggers/functions -- User creation automation
```

#### 2. Agent System (4 tables)
```sql
public.sessions           -- Chat sessions
public.messages          -- Conversation history  
public.agent_conversations -- Agent-specific chats
public.tasks             -- Agent task tracking
```

#### 3. Metrics & KPI (5 tables) 
```sql
public.companies         -- Client organizations
public.departments       -- Org structure
public.kpis             -- KPI definitions
public.kpi_values       -- Historical data
public.kpi_targets      -- Performance goals
```

#### 4. LLM & Evaluation (3 tables)
```sql
public.providers         -- AI providers (Ollama, Anthropic, etc.)
public.models           -- Available models
public.llm_evaluations  -- Performance tracking
```

**Total: 15 essential tables** (down from 30+ current tables)

### Client Benefits

#### 1. Faster Deployment
- ✅ **Single migration** instead of 24+ files
- ✅ **2-minute database setup** instead of 10+ minutes
- ✅ **No migration conflicts** or ordering issues

#### 2. Cleaner Database
- ✅ **Essential tables only** - No development artifacts
- ✅ **Optimized schema** - Better performance
- ✅ **Clear documentation** - Easy to understand

#### 3. Production Ready
- ✅ **No test data** in production template
- ✅ **Proper RLS policies** - Security by default
- ✅ **Scalable design** - Ready for client data

### Migration File Structure

```
_supabase/
├── migrations/
│   └── 00_initial_schema.sql     # Single comprehensive migration
├── seed/                         # Optional seed data
│   ├── essential_providers.sql   # AI providers and models
│   └── sample_companies.sql      # Optional sample data
└── docs/
    ├── schema.md                 # Database documentation
    └── migration_changelog.md    # What was removed/changed
```

## Implementation Phases

### Phase 1: Migration Cleanup (Priority)
- [ ] **Audit current migrations** - Identify essential vs. development tables
- [ ] **Create consolidated migration** - Single `00_initial_schema.sql`
- [ ] **Test fresh deployment** - Validate new migration works
- [ ] **Update documentation** - Schema docs for clients

### Phase 2: Core Containerization
- [ ] Create Dockerfiles for API and Frontend
- [ ] Set up Supabase container with clean migration
- [ ] Configure Ollama multi-model container
- [ ] Basic docker-compose.yml

### Phase 2: MCP Services Integration
- [ ] Build MCP services container
- [ ] Configure STDIO MCP communication
- [ ] Set up Zapier HTTP MCP integration
- [ ] Test all MCP consumer services

### Phase 3: Production Features
- [ ] Add Nginx reverse proxy
- [ ] Implement SSL/HTTPS support
- [ ] Add health checks and monitoring
- [ ] Configure resource limits

### Phase 4: Client Experience
- [ ] Create comprehensive README
- [ ] Add configuration templates
- [ ] Build automated setup scripts
- [ ] Create video tutorials

### Phase 5: Advanced Features
- [ ] Multi-environment support (dev/staging/prod)
- [ ] Kubernetes deployment options
- [ ] Cloud deployment guides (AWS/GCP/Azure)
- [ ] Backup and restore procedures

## Success Metrics

**Client Onboarding Time**: < 5 minutes from clone to running
**Setup Commands**: 3 or fewer commands
**External Dependencies**: Zero (except Docker)
**Documentation Pages**: < 10 pages total
**Support Tickets**: < 1 per 100 deployments

## Future Enhancements

### Container Orchestration
- **Kubernetes Helm Charts** - For enterprise deployments
- **Docker Swarm Support** - For multi-node deployments
- **Auto-scaling** - Based on agent usage

### Monitoring & Observability
- **Prometheus/Grafana** - Metrics and dashboards
- **ELK Stack** - Centralized logging
- **Jaeger** - Distributed tracing

### Security Enhancements
- **Vault Integration** - Secret management
- **RBAC** - Role-based access control
- **Network Policies** - Container isolation

## Conclusion

This dockerization plan transforms the AI agent platform from a development project into a **production-ready, client-deployable solution**. Clients get a complete AI agent platform with zero configuration, zero external dependencies, and zero MCP knowledge required.

The result is a true **"AI Agent Platform in a Box"** that positions the product as an enterprise-ready solution rather than a development framework.
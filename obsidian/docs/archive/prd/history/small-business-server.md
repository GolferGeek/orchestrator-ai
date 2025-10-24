# Small Business AI Server - Product Requirements Document

## Executive Summary

Transform the Orchestrator-AI platform into a turnkey small business AI solution that clients can deploy on their own servers. This initiative creates a complete business model where clients purchase their own dedicated AI infrastructure, running a forked version of our codebase tailored to their specific industry needs.

## Business Context

### Current State
- Orchestrator-AI exists as a sophisticated multi-agent AI platform
- Runs on SaaS Supabase with cloud dependencies
- Development environment on Mac Studio with 128GB RAM

### Target State
- Self-contained AI server solution for small businesses
- Clients get their own forked codebase and dedicated hardware
- Hybrid deployment: npm for development, Docker for production
- Local Supabase instance shared across multiple development projects

## Product Vision

**"Enable any small business to deploy their own AI workforce in under an hour, with ongoing support and customization from our team."**

## Target Market

### Primary Users
- Small to medium businesses (5-50 employees)
- Professional services (law, accounting, consulting)
- Creative agencies and marketing firms
- Manufacturing companies with operational complexity
- Healthcare practices and clinics

### Technical Requirements
- Willingness to invest $500-2000 in dedicated hardware
- Basic understanding of business process automation
- Comfort with subscription-based support model

## Core Features

### 1. Landing Pages & Demo System
**User Story**: As a potential client, I want to understand the value proposition and see the system in action before committing to purchase.

**Requirements**:
- Compelling landing page integrated into the web app
- Industry-specific demo scenarios
- Loom video integration showcasing key capabilities
- "Try it now" sandbox environments
- Clear pricing and deployment information
- Lead capture and consultation scheduling

### 2. Dual Supabase Configuration
**User Story**: As a developer, I want to seamlessly switch between local and cloud database instances for different projects.

**Requirements**:
- Environment variable-based mode switching (`SUPABASE_MODE=local|cloud`)
- Single local Supabase Docker instance supporting multiple databases
- Clean migration path from existing cloud setup
- Database isolation for different projects (orchestrator-ai, hierarchy-ai)
- Shared authentication system across databases

### 3. Client Deployment Templates
**User Story**: As a client, I want to deploy my own AI server with minimal technical knowledge and maximum reliability.

**Requirements**:
- Complete Docker Compose setup for production deployment
- One-command deployment: `docker-compose up -d`
- Automatic SSL certificate management via Let's Encrypt
- Health monitoring and restart policies
- Backup and restore procedures
- Resource optimization profiles (16GB, 32GB, 64GB+ RAM)

### 4. Ollama Integration
**User Story**: As a client, I want the option to run local AI models for privacy and cost control.

**Requirements**:
- Docker container for Ollama with popular models pre-configured
- Optional deployment based on available RAM
- Fallback to API providers (Anthropic, OpenAI) when local models unavailable
- Model management interface for adding/removing models
- Performance monitoring and resource usage tracking

### 5. Fork Management System
**User Story**: As the service provider, I want to efficiently manage multiple client forks with custom branding and functionality.

**Requirements**:
- Clear documentation for forking process
- Template system for client customizations
- Branding/theming configuration points
- Industry-specific agent templates
- Version control strategy for client updates
- Merge strategy for core platform improvements

## Technical Architecture

### Development Setup (Your Mac Studio)
```
┌─────────────────────────────────────────┐
│ Mac Studio (128GB RAM)                  │
├─────────────────────────────────────────┤
│ Docker Services:                        │
│ ├── Supabase (multiple DBs)             │
│ ├── Ollama (shared models)              │
│ └── Nginx (reverse proxy)               │
├─────────────────────────────────────────┤
│ npm Services:                           │
│ ├── orchestrator-ai (npm run dev:api)   │
│ ├── hierarchy-ai (npm run dev:api)      │
│ └── Web apps (npm run dev:web)          │
└─────────────────────────────────────────┘
```

### Client Production Setup
```
┌─────────────────────────────────────────┐
│ Client Server (16-64GB RAM)             │
├─────────────────────────────────────────┤
│ Docker Containers:                      │
│ ├── PostgreSQL (Supabase)               │
│ ├── Auth & APIs (Supabase)              │
│ ├── NestJS Backend                      │
│ ├── Vue Frontend                        │
│ ├── Nginx Reverse Proxy                 │
│ ├── Ollama (optional)                   │
│ └── Monitoring (Grafana/Prometheus)     │
└─────────────────────────────────────────┘
```

## Success Metrics

### Technical Metrics
- Deployment time: < 30 minutes from download to running
- Uptime: > 99.5% after initial deployment
- Memory usage: < 8GB for basic deployment (without Ollama)
- Response time: < 2 seconds for typical AI agent requests

### Business Metrics
- Lead conversion rate: > 15% from landing page to consultation
- Client deployment success rate: > 95% within first attempt
- Client satisfaction score: > 4.5/5 in first 30 days
- Support ticket volume: < 2 tickets per client per month

## Risk Assessment

### Technical Risks
- **Migration complexity**: Moving from SaaS to local Supabase
  - *Mitigation*: Comprehensive testing and migration scripts
- **Docker complexity**: Client deployment failures
  - *Mitigation*: Extensive documentation and automated health checks
- **Resource requirements**: Clients with insufficient hardware
  - *Mitigation*: Clear minimum requirements and configuration profiles

### Business Risks
- **Support burden**: High maintenance overhead per client
  - *Mitigation*: Self-healing infrastructure and comprehensive documentation
- **Version management**: Keeping client forks updated
  - *Mitigation*: Automated update system and clear versioning strategy

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- Dual Supabase configuration
- Basic Docker infrastructure
- Landing page framework

### Phase 2: Client Templates (Week 2)
- Production Docker Compose setup
- Deployment documentation
- Fork management system

### Phase 3: Production Ready (Week 3)
- SSL automation
- Monitoring setup
- Comprehensive testing

### Phase 4: Launch Ready (Week 4)
- Landing pages complete
- Demo scenarios
- Client onboarding process

## Success Criteria

✅ **MVP Complete When**:
- Existing orchestrator-ai runs locally with Docker Supabase
- Client can deploy forked version with single command
- Landing pages convert visitors to qualified leads
- First paying client successfully deployed and operational

✅ **Market Ready When**:
- 5+ successful client deployments
- Support processes documented and tested
- Automated update system operational
- Revenue positive from first month of sales

## Next Steps

1. Complete technical architecture documentation
2. Create client deployment guide
3. Implement Docker configurations
4. Build and test deployment pipeline
5. Develop landing pages and demo content
6. Launch pilot program with friendly clients
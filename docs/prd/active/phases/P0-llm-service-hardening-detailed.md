# Phase 0: Central LLM Service Hardening - Detailed PRD

## Executive Summary

**Project**: David's Goliath Privacy Initiative  
**Phase**: P0 - Foundation Layer  
**Status**: Active Development  
**Priority**: P0 (Critical Path)

Phase 0 establishes the foundational architecture for a comprehensive privacy-preserving LLM service by enforcing centralized request routing, eliminating direct provider access, and implementing baseline security measures. This phase creates the technical foundation required for subsequent privacy features including data classification (P1), routing/caching (P2), evaluation/monitoring (P3), and sovereign mode (P4).

## Problem Statement

### Current State Issues
- **Decentralized Provider Access**: Agents make direct API calls to various LLM providers (OpenAI, Anthropic, etc.)
- **No Request Visibility**: No centralized monitoring or metadata collection for LLM requests
- **Training Data Exposure**: No consistent no-train/no-retain flags across providers
- **Inconsistent Security**: Varied approaches to handling secrets and sensitive data
- **Debugging Complexity**: Lack of correlation IDs and run metadata for troubleshooting

### Future State Dependencies
Phase 0 is the critical foundation that enables:
- **P1**: Privacy relay requires centralized request path for classification and redaction
- **P2**: Routing and caching need single ingress/egress points  
- **P3**: Evaluation and monitoring require standardized metadata collection
- **P4**: Sovereign mode needs centralized control to block external egress

## Goals and Success Criteria

### Primary Goals
1. **100% Centralization**: All agent LLM calls must traverse the centralized service
2. **Provider Hardening**: Set no-train/no-retain flags where supported by providers
3. **Request Traceability**: Generate run metadata for every LLM request
4. **Security Foundation**: Implement secret redaction and proper logging practices
5. **Development Visibility**: Provide developer tools to inspect LLM operations

### Success Metrics
- **Zero Direct Provider Calls**: No agent code directly instantiates provider clients
- **Complete Run Metadata**: 100% of requests return provider, latency, cost, runId
- **Security Compliance**: All logs redact secrets, include correlation IDs
- **Developer Experience**: Metadata panel provides actionable debugging information

### Acceptance Criteria
- ✅ 100% of agent LLM calls traverse the centralized service
- ✅ Responses include non-PII run metadata
- ✅ Provider adapters set no-train/no-retain where supported  
- ✅ No frontend or agent code makes direct provider API calls
- ✅ Shared SDK enforces service URL and rejects direct provider clients
- ✅ Developer panel displays run metadata with valid runIds

## Technical Architecture

### System Overview
```
[Agents] -> [Shared SDK] -> [Centralized LLM Service] -> [Provider Adapters] -> [External LLMs]
                                      |
                                      v
                            [Run Metadata & Logging]
                                      |
                                      v
                              [Developer Dashboard]
```

### Core Components

#### 1. Shared SDK Module
**Location**: TBD (new centralized module)  
**Purpose**: Single entry point for all agent LLM requests

**Key Features**:
- Enforces centralized service URL routing
- Rejects any attempt to instantiate direct provider clients
- Automatically injects required headers (`X-Policy-Profile`, `X-Data-Class`, `X-Sovereign-Mode`)
- Returns enhanced responses with run metadata

**API Design**:
```typescript
interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  // ... other LLM parameters
}

interface LLMResponse {
  content: string;
  runMetadata: {
    runId: string;
    provider: string;
    latency: number;
    costApprox: number;
    timestamp: string;
  };
}

// SDK enforces this pattern only
const response = await centralizedLLM.complete(request);
```

#### 2. Centralized LLM Service
**Location**: Existing LLM service (enhancement)  
**Purpose**: Single egress point for all external LLM requests

**Enhancements**:
- **Provider Configuration Module**: Centralized config with no-train/no-retain flags
- **Request Headers**: Process and forward policy headers from SDK
- **Run Metadata Generation**: Create unique runId, track timing, estimate costs
- **Logging Enhancement**: Redact secrets, include correlation IDs, disable body logging in prod

#### 3. Provider Adapters
**Location**: Within centralized LLM service  
**Purpose**: Standardized interfaces to external LLM providers

**Hardening Features**:
- Set `X-No-Train: true` headers where supported (OpenAI, Anthropic)
- Set `X-No-Retain: true` headers where supported
- Configure appropriate timeouts per provider
- Standardize error handling and retry logic

#### 4. Local Model Management Service
**Location**: New service within centralized LLM service  
**Purpose**: Manage three-tier local model architecture with always-on availability

**Three-Tier Model Strategy**:
- **Tier 1 - Fast Thinking**: GPT-oss 2B and 20B (good reasoning, fast inference)
- **Tier 2 - Ultra-Fast**: Llama 3.2 (optimized for speed, basic tasks)
- **Tier 3 - General**: Llama 3.1 8B, Qwen 2.5 7B (fallback, versatile)

**Core Features**:
- **Live Model Detection**: Query Ollama `/api/tags` to detect loaded models
- **Always-On Management**: Ensure all three tiers are loaded and available
- **Model Health Monitoring**: Track response times and availability per model
- **Smart Preloading**: Automatically load required models on service startup
- **Routing Intelligence**: Route requests to appropriate tier based on complexity

#### 5. Developer Panel (Frontend)
**Location**: Web application developer tools section  
**Purpose**: Provide visibility into LLM operations and local model status

**Features**:
- Display run metadata: provider, latency, cost estimate, runId
- **Local Model Dashboard**: Show status of three-tier local models
- **Routing Decisions**: Display local vs. external routing choices
- Show/hide based on metadata presence
- Developer-only access (not production user-facing)
- No storage of actual request/response content

## Implementation Plan

### Test Harness Strategy
**Primary Test Path**: `apps/api/src/agents/actual/finance/metrics/agent-function.ts`
- Single, well-understood agent for consistent testing
- Uses standard KPI prompt fixtures with synthetic identifiers
- Safe for redaction/pseudonymization testing in future phases

### Backend Implementation

#### Phase 1: Shared SDK Creation
- Create new centralized SDK module with enforced routing
- Implement provider client rejection mechanism  
- Add automatic header injection (`X-Policy-Profile`, `X-Data-Class`, `X-Sovereign-Mode`)
- Build run metadata response enhancement

#### Phase 2: Provider Configuration Centralization & Local Model Setup
- Move all provider configurations to single module
- Implement no-train/no-retain flag settings per provider:
  - OpenAI: `X-No-Store: true`, custom headers
  - Anthropic: Policy compliance headers
  - Other providers: Best-effort equivalent headers
- Set standardized timeouts and retry policies
- **Local Model Tier Configuration**:
  - Configure three-tier model mapping in database
  - Set up model preloading priorities (Tier 1: High, Tier 2: High, Tier 3: Medium)
  - Implement Ollama health check and model availability detection

#### Phase 3: Agent Migration
- Replace direct provider clients in all agent code
- Update import statements to use shared SDK only
- Remove provider-specific client instantiation
- Test with Metrics/KPI agent first, then expand

#### Phase 4: Enhanced Logging, Metadata & Local Model Integration  
- Implement runId generation and correlation
- Add response metadata (provider, latency, cost estimation)
- **Enhanced Metadata for Local Models**:
  - Include local vs. external routing decisions
  - Track which tier was used (fast-thinking, ultra-fast, general)
  - Monitor local model response times and availability
- Update logging to redact secrets and include runIds
- Disable provider request body logging in production
- **Local Model Management Service**:
  - Implement three-tier model detection and preloading
  - Add model health monitoring and auto-restart capabilities
  - Create routing logic to select appropriate local model tier

### Frontend Implementation

#### Developer Panel Features
```typescript
interface RunMetadataPanel {
  runId: string;
  provider: string;
  isLocal: boolean;
  modelTier?: 'fast-thinking' | 'ultra-fast' | 'general';
  actualModel: string;
  latency: number;
  costApprox: number;
  timestamp: string;
  visible: boolean; // based on metadata presence
}

interface LocalModelStatus {
  fastThinkingModels: Array<{name: string, loaded: boolean, healthy: boolean}>;
  ultraFastModels: Array<{name: string, loaded: boolean, healthy: boolean}>;
  generalModels: Array<{name: string, loaded: boolean, healthy: boolean}>;
  ollamaConnected: boolean;
  lastHealthCheck: string;
}
```

#### UI/UX Requirements
- Clean, minimal interface integrated into existing developer tools
- Collapsible panel that appears only when metadata is present
- **Local Model Status Indicator**: Green/yellow/red status lights for each tier
- **Routing Decision Display**: Clear indication of local vs. external routing
- Clear labeling of cost estimates as approximate (local models show $0.00)
- Responsive design for various screen sizes
- Real-time updates for local model health status

## Testing Strategy

### Unit Tests
1. **SDK Enforcement**: Verify shared SDK prevents direct provider client instantiation
2. **Header Injection**: Confirm automatic addition of required headers
3. **Metadata Generation**: Test runId uniqueness and metadata completeness
4. **Configuration Loading**: Validate provider settings and flag application
5. **Local Model Detection**: Test Ollama API integration and model status detection
6. **Tier Routing Logic**: Verify correct model tier selection based on request complexity
7. **Health Monitoring**: Test model availability detection and auto-recovery

### Integration Tests
1. **End-to-End Flow**: Agent → SDK → Service → Provider → Response with metadata
2. **No-Train Verification**: Confirm no-train flags present in provider adapter calls
3. **Logging Validation**: Check secret redaction and runId correlation in logs
4. **Error Handling**: Test fallback behavior and error propagation
5. **Local-First Routing**: Test preference for local models when available
6. **Fallback to External**: Verify external routing when local models are unavailable
7. **Three-Tier Integration**: Test routing to appropriate tier based on complexity

### End-to-End Tests
1. **Agent Simulation**: Full Metrics/KPI agent execution via centralized service only
2. **Network Verification**: Confirm no direct provider outbound connections from agents
3. **UI Integration**: Developer panel displays metadata for actual agent runs
4. **Log Correlation**: Trace requests through entire system using runId
5. **Local Model Lifecycle**: Test model preloading, health monitoring, and auto-recovery
6. **Always-On Verification**: Ensure three-tier models remain loaded during extended use
7. **Performance Benchmarking**: Compare local vs. external model response times

## Security Considerations

### Data Protection
- **Secret Redaction**: All logs must redact API keys, tokens, and sensitive configuration
- **Request Body Logging**: Disabled in production to prevent data exposure
- **Correlation IDs**: Enable request tracing without exposing sensitive data

### Access Control
- **Developer Panel**: Restricted to development environments and authorized users
- **Service Endpoints**: Proper authentication for centralized LLM service
- **Provider Configuration**: Secure storage of API keys and service configurations

### Audit Trail
- **Run Metadata**: Comprehensive logging of all LLM requests with correlation
- **Provider Compliance**: Documentation of no-train/no-retain flag usage
- **Access Logging**: Track which agents make requests through centralized service

## Risk Assessment

### High Risks
1. **Agent Migration Complexity**: Many agents may have deeply embedded provider clients
   - *Mitigation*: Phased migration starting with Metrics/KPI agent
2. **Performance Impact**: Additional network hop through centralized service
   - *Mitigation*: Performance testing and optimization of service layer

### Medium Risks
1. **Provider API Changes**: External providers may modify header requirements
   - *Mitigation*: Centralized configuration enables quick updates
2. **Developer Experience**: Additional complexity in local development
   - *Mitigation*: Clear documentation and developer panel visibility

### Low Risks
1. **Metadata Storage**: Potential for metadata to consume significant storage
   - *Mitigation*: Implement retention policies and lightweight metadata design

## Success Measurement

### Key Performance Indicators
- **Migration Completion**: % of agents using centralized service (Target: 100%)
- **Request Coverage**: % of LLM requests with complete run metadata (Target: 100%)
- **Security Compliance**: % of logs with properly redacted secrets (Target: 100%)
- **Developer Adoption**: Usage of metadata panel by development team

### Monitoring and Alerting
- **Direct Provider Detection**: Alerts for any direct provider API calls
- **Metadata Completeness**: Monitoring for requests missing run metadata
- **Service Health**: Standard uptime and performance monitoring for centralized service
- **Error Rates**: Track failures in centralized service vs. direct provider calls

## Timeline and Milestones

### Sprint 1 (Week 1-2): Foundation
- [ ] Create shared SDK module with basic routing
- [ ] Set up centralized provider configuration  
- [ ] Implement runId generation and basic metadata
- [ ] **Local Model Infrastructure**:
  - [ ] Set up three-tier model configuration in database
  - [ ] Create Ollama API integration for model detection
  - [ ] Implement basic model health checking

### Sprint 2 (Week 3-4): Core Implementation  
- [ ] Add no-train/no-retain flags to provider adapters
- [ ] Implement secret redaction in logging
- [ ] Create developer panel UI components
- [ ] **Local Model Management**:
  - [ ] Implement three-tier routing logic
  - [ ] Add model preloading and always-on management
  - [ ] Create local model status dashboard

### Sprint 3 (Week 5-6): Integration and Testing
- [ ] Migrate Metrics/KPI agent to use shared SDK
- [ ] Complete integration testing suite
- [ ] Deploy to development environment
- [ ] **Local Model Testing**:
  - [ ] Test three-tier model performance and routing
  - [ ] Validate always-on model availability
  - [ ] Benchmark local vs. external model response times

### Sprint 4 (Week 7-8): Migration and Validation
- [ ] Migrate remaining agents to centralized service
- [ ] Complete end-to-end testing
- [ ] Validate 100% centralization achievement
- [ ] **Local Model Production Readiness**:
  - [ ] Optimize model loading and memory management
  - [ ] Implement production monitoring and alerting
  - [ ] Document three-tier model operation procedures

## Dependencies and Prerequisites

### External Dependencies
- Access to all currently used LLM provider APIs
- Provider documentation for no-train/no-retain header specifications
- Development environment with agent testing capabilities
- **Local Model Dependencies**:
  - Ollama installation and configuration (http://localhost:11434)
  - GPT-oss 2B and 20B models available for download/installation
  - Llama 3.2 model variants available via Ollama
  - Sufficient GPU/CPU resources for three concurrent models
  - Storage capacity for multiple large language models

### Internal Dependencies
- Existing LLM service codebase for enhancement
- Agent codebase access for migration
- Web application for developer panel integration
- Logging and monitoring infrastructure

## Future Considerations

### Phase 1 (P1) Preparation
- Metadata collection supports future data classification
- Request/response structure accommodates redaction workflows
- Logging format enables privacy audit requirements

### Scalability Planning
- Centralized service designed for horizontal scaling
- Metadata storage considers future volume requirements
- Provider adapter architecture supports new provider additions

### Monitoring Evolution
- Basic metadata collection evolves to support evaluation metrics (P3)
- Logging structure supports future compliance and audit requirements (P4)
- Developer tools foundation for advanced privacy visibility features

---

**Document Version**: 1.0  
**Last Updated**: 2025-09-02  
**Next Review**: Upon Phase 0 completion
# P0 LLM Service Hardening - Taskmaster AI Task List

## Project Overview
**Phase**: P0 - Central LLM Service Hardening  
**Goal**: Establish foundational architecture for David's Goliath privacy initiative with centralized LLM routing and three-tier local model management  
**Timeline**: 4 Sprints (8 weeks)

---

## Sprint 1: Foundation Infrastructure (Weeks 1-2)

### 1.1 Shared SDK Module Creation
**Priority**: P0 Critical  
**Effort**: 3-5 days  
**Dependencies**: None

#### Tasks:
- [ ] Create new centralized SDK module at `apps/api/src/llm-sdk/`
- [ ] Implement enforced routing to centralized service URL
- [ ] Add provider client rejection mechanism (throw errors on direct instantiation)
- [ ] Build automatic header injection system:
  - [ ] `X-Policy-Profile` (default: 'standard')
  - [ ] `X-Data-Class` (default: 'public')
  - [ ] `X-Sovereign-Mode` (default: 'false')
- [ ] Create enhanced response wrapper with run metadata
- [ ] Write comprehensive unit tests for SDK enforcement

**Acceptance Criteria**:
- SDK prevents any direct provider client creation
- All requests automatically include required headers
- Run metadata is returned with every response

### 1.2 Three-Tier Local Model Database Configuration
**Priority**: P0 Critical  
**Effort**: 2-3 days  
**Dependencies**: Existing database schema

#### Tasks:
- [ ] Extend `llm_models` table with local model columns:
  ```sql
  ALTER TABLE orchestrator.llm_models 
  ADD COLUMN is_local BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_currently_loaded BOOLEAN DEFAULT FALSE,
  ADD COLUMN model_tier VARCHAR(50),
  ADD COLUMN loading_priority INTEGER DEFAULT 0;
  ```
- [ ] Create seed data for three-tier model configuration:
  - [ ] **Tier 1 (Fast Thinking)**: GPT-oss 2B, GPT-oss 20B
  - [ ] **Tier 2 (Ultra-Fast)**: Llama 3.2:1b, Llama 3.2:3b
  - [ ] **Tier 3 (General)**: Llama 3.1:8b, Qwen 2.5:7b
- [ ] Update provider service to handle local model metadata
- [ ] Create migration script for existing Ollama models

**Acceptance Criteria**:
- Database contains all three tiers with proper configuration
- Local models are marked with appropriate tier and priority
- Migration preserves existing Ollama model data

### 1.3 Ollama API Integration Service
**Priority**: P0 Critical  
**Effort**: 3-4 days  
**Dependencies**: Ollama installation

#### Tasks:
- [ ] Create `LocalModelStatusService` at `apps/api/src/local-models/`
- [ ] Implement Ollama API client:
  - [ ] GET `/api/tags` - list available models
  - [ ] GET `/api/show/:model` - get model details
  - [ ] POST `/api/pull` - download models if needed
- [ ] Build model health checking system:
  - [ ] Test model response times
  - [ ] Validate model availability
  - [ ] Detect memory usage and performance
- [ ] Create model status caching (5-second TTL for performance)
- [ ] Add error handling and retry logic

**Acceptance Criteria**:
- Service can detect which models are currently loaded
- Health checks provide accurate status for each model
- Service gracefully handles Ollama unavailability

### 1.4 RunId Generation and Basic Metadata
**Priority**: P1 Important  
**Effort**: 2 days  
**Dependencies**: Shared SDK

#### Tasks:
- [ ] Implement unique runId generation (UUID v4)
- [ ] Create metadata collection system in centralized service
- [ ] Add basic timing and cost estimation
- [ ] Implement correlation logging with runId
- [ ] Update response format to include:
  ```typescript
  {
    content: string;
    runMetadata: {
      runId: string;
      provider: string;
      isLocal: boolean;
      modelTier?: string;
      actualModel: string;
      latency: number;
      costApprox: number;
      timestamp: string;
    }
  }
  ```

**Acceptance Criteria**:
- Every LLM request generates unique runId
- Metadata accurately reflects routing decisions
- Logs can be correlated using runId

---

## Sprint 2: Core Implementation (Weeks 3-4)

### 2.1 Provider Configuration Centralization
**Priority**: P0 Critical  
**Effort**: 3-4 days  
**Dependencies**: Sprint 1 completion

#### Tasks:
- [ ] Create centralized provider configuration module
- [ ] Implement no-train/no-retain flag system:
  - [ ] **OpenAI**: `X-No-Store: true`, custom headers
  - [ ] **Anthropic**: Policy compliance headers  
  - [ ] **Others**: Best-effort equivalent headers
- [ ] Set standardized timeouts per provider (30s default)
- [ ] Create provider adapter factory pattern
- [ ] Move all existing provider configs to central module
- [ ] Update environment variable handling

**Acceptance Criteria**:
- All provider configurations centralized in single module
- No-train flags properly set for supported providers
- Consistent timeout and retry policies across providers

### 2.2 Three-Tier Routing Logic Implementation
**Priority**: P0 Critical  
**Effort**: 4-5 days  
**Dependencies**: Local model database config, Ollama integration

#### Tasks:
- [ ] Create intelligent routing service:
  - [ ] Complexity analysis for request classification
  - [ ] Tier selection algorithm (simple → ultra-fast, complex → fast-thinking)
  - [ ] Local-first routing preference
  - [ ] External fallback when local unavailable
- [ ] Implement model preloading system:
  - [ ] Auto-load high-priority models on service startup
  - [ ] Keep three-tier models always loaded in memory
  - [ ] Memory management and optimization
- [ ] Create routing decision logging
- [ ] Add performance monitoring per tier

**Acceptance Criteria**:
- Requests correctly routed to appropriate model tier
- Local models preferred when available and suitable
- All three tiers remain loaded during normal operation

### 2.3 Enhanced Logging and Secret Redaction
**Priority**: P1 Important  
**Effort**: 2-3 days  
**Dependencies**: RunId system

#### Tasks:
- [ ] Implement comprehensive secret redaction:
  - [ ] API keys and tokens
  - [ ] User credentials
  - [ ] Sensitive configuration data
- [ ] Add runId correlation to all log entries
- [ ] Disable request/response body logging in production
- [ ] Create structured logging format:
  ```json
  {
    "runId": "uuid",
    "timestamp": "iso-string",
    "level": "info|warn|error",
    "provider": "openai|anthropic|ollama",
    "isLocal": boolean,
    "modelTier": "fast-thinking|ultra-fast|general",
    "latency": number,
    "message": "redacted-content"
  }
  ```

**Acceptance Criteria**:
- No secrets visible in any log output
- All requests traceable via runId
- Production logs properly sanitized

### 2.4 Developer Panel UI Components
**Priority**: P2 Nice-to-have  
**Effort**: 3-4 days  
**Dependencies**: Metadata system

#### Tasks:
- [ ] Create `RunMetadataPanel` Vue component:
  - [ ] Display runId, provider, model tier, latency, cost
  - [ ] Show/hide based on metadata presence
  - [ ] Real-time updates for new requests
- [ ] Build `LocalModelStatus` dashboard:
  - [ ] Three-tier status indicators (green/yellow/red)
  - [ ] Model health and response time metrics
  - [ ] Ollama connection status
  - [ ] Last health check timestamp
- [ ] Add routing decision visualization
- [ ] Integrate with existing developer tools
- [ ] Implement responsive design

**Acceptance Criteria**:
- Panel displays accurate run metadata
- Local model status updates in real-time
- Clear indication of local vs. external routing

---

## Sprint 3: Integration and Testing (Weeks 5-6)

### 3.1 Metrics/KPI Agent Migration
**Priority**: P0 Critical  
**Effort**: 2-3 days  
**Dependencies**: Shared SDK, routing system

#### Tasks:
- [ ] Update Metrics/KPI agent (`apps/api/src/agents/actual/finance/metrics/`)
- [ ] Replace direct provider clients with shared SDK
- [ ] Update import statements and remove provider dependencies
- [ ] Test agent functionality with centralized service
- [ ] Verify metadata collection and logging
- [ ] Validate three-tier routing with agent requests

**Acceptance Criteria**:
- Agent successfully uses only centralized service
- All agent requests generate proper metadata
- No direct provider connections from agent code

### 3.2 Comprehensive Integration Testing
**Priority**: P0 Critical  
**Effort**: 3-4 days  
**Dependencies**: Agent migration

#### Tasks:
- [ ] End-to-end flow testing:
  - [ ] Agent → SDK → Service → Provider → Response
  - [ ] Local model routing validation
  - [ ] External fallback verification
- [ ] No-train header verification across all providers
- [ ] Secret redaction validation in logs
- [ ] RunId correlation testing across entire request flow
- [ ] Error handling and fallback behavior testing
- [ ] Performance baseline establishment

**Acceptance Criteria**:
- 100% of requests flow through centralized service
- No-train flags present in all external provider calls
- Secrets properly redacted in all log outputs
- Error handling works correctly for all scenarios

### 3.3 Local Model Performance Testing
**Priority**: P1 Important  
**Effort**: 2-3 days  
**Dependencies**: Three-tier routing

#### Tasks:
- [ ] Benchmark three-tier model performance:
  - [ ] Response time analysis per tier
  - [ ] Memory usage and resource consumption
  - [ ] Concurrent request handling
- [ ] Always-on availability validation:
  - [ ] Extended runtime testing (24+ hours)
  - [ ] Model persistence through service restarts
  - [ ] Auto-recovery from model failures
- [ ] Local vs. external performance comparison
- [ ] Load testing with realistic agent workloads

**Acceptance Criteria**:
- All three tiers maintain sub-2s response times
- Models remain loaded during extended operation
- Local routing provides measurable performance benefits

### 3.4 Development Environment Deployment
**Priority**: P1 Important  
**Effort**: 2 days  
**Dependencies**: Integration testing completion

#### Tasks:
- [ ] Deploy enhanced centralized service to dev environment
- [ ] Configure Ollama with three-tier models
- [ ] Update dev environment documentation
- [ ] Validate service health and monitoring
- [ ] Test developer panel in deployed environment
- [ ] Create deployment verification checklist

**Acceptance Criteria**:
- Dev environment fully operational with local models
- All monitoring and logging working correctly
- Developer panel accessible and functional

---

## Sprint 4: Migration and Production Readiness (Weeks 7-8)

### 4.1 Remaining Agent Migration
**Priority**: P0 Critical  
**Effort**: 4-5 days  
**Dependencies**: Sprint 3 validation

#### Tasks:
- [ ] Identify all agents with direct provider usage
- [ ] Create migration checklist and process
- [ ] Migrate agents in priority order:
  1. High-usage agents first
  2. Test agents with shared SDK
  3. Validate functionality and performance
- [ ] Update documentation and examples
- [ ] Remove deprecated provider client code

**Acceptance Criteria**:
- 100% of agents use centralized service only
- No direct provider client instantiation anywhere
- All agent functionality preserved post-migration

### 4.2 End-to-End System Validation
**Priority**: P0 Critical  
**Effort**: 2-3 days  
**Dependencies**: Complete agent migration

#### Tasks:
- [ ] Full system validation testing:
  - [ ] All agents working through centralized service
  - [ ] Network traffic verification (no direct external calls)
  - [ ] Complete request flow tracing
  - [ ] UI integration validation
- [ ] Performance validation under load
- [ ] Security audit of logging and secret handling
- [ ] Documentation review and updates

**Acceptance Criteria**:
- Zero direct provider connections detected
- All system components properly integrated
- Performance meets or exceeds baseline requirements

### 4.3 Local Model Production Optimization
**Priority**: P1 Important  
**Effort**: 3-4 days  
**Dependencies**: Performance testing

#### Tasks:
- [ ] Optimize model loading and memory management:
  - [ ] Implement efficient model caching
  - [ ] Optimize GPU/CPU resource allocation
  - [ ] Memory pressure handling
- [ ] Production monitoring and alerting:
  - [ ] Model health monitoring
  - [ ] Performance degradation alerts
  - [ ] Resource usage tracking
- [ ] Create operational runbooks:
  - [ ] Model restart procedures
  - [ ] Troubleshooting guides
  - [ ] Performance tuning guidelines

**Acceptance Criteria**:
- Models efficiently use available resources
- Comprehensive monitoring covers all aspects
- Operations team has clear procedures

### 4.4 Documentation and Knowledge Transfer
**Priority**: P1 Important  
**Effort**: 2 days  
**Dependencies**: System completion

#### Tasks:
- [ ] Create comprehensive system documentation:
  - [ ] Architecture overview and diagrams
  - [ ] Configuration and deployment guides
  - [ ] API documentation for shared SDK
- [ ] Developer onboarding materials
- [ ] Operations and maintenance guides
- [ ] Performance tuning and optimization docs
- [ ] Conduct knowledge transfer sessions

**Acceptance Criteria**:
- Complete documentation available
- Development team trained on new architecture
- Operations team ready for production support

---

## Success Metrics

### Primary KPIs
- **100% Centralization**: All LLM calls through centralized service
- **Complete Metadata**: All requests include runId and routing info
- **Local Model Availability**: 99%+ uptime for three-tier models
- **Performance**: <2s average response time for local models
- **Security**: Zero secrets in logs, 100% redaction compliance

### Secondary KPIs
- **Developer Experience**: <10 minutes to onboard new agents
- **Cost Optimization**: Measurable reduction in external API costs
- **Monitoring Coverage**: 100% of requests tracked and logged
- **Error Rate**: <1% failure rate for centralized service
- **Documentation**: Complete coverage of all components

---

## Risk Mitigation

### High-Risk Items
1. **Agent Migration Complexity**: Start with single test agent, iterate
2. **Local Model Resource Usage**: Monitor and optimize continuously
3. **Performance Impact**: Baseline early, optimize throughout

### Medium-Risk Items
1. **Ollama Dependency**: Plan fallback strategies
2. **Model Loading Time**: Implement preloading and caching
3. **Development Team Adoption**: Provide clear migration guides

### Low-Risk Items
1. **UI Integration**: Non-blocking, can be completed after core
2. **Documentation**: Parallel development throughout project
3. **Monitoring Setup**: Build incrementally with each component

---

## Dependencies and Blockers

### External Dependencies
- Ollama installation and model availability
- GPU/CPU resources for local model hosting
- Network access for external provider APIs

### Internal Dependencies
- Database schema migration approval
- Development environment access
- Agent codebase modification permissions

### Potential Blockers
- Resource constraints for local model hosting
- Agent migration revealing unexpected dependencies
- Performance issues with concurrent local models

---

**Document Version**: 1.0  
**Created**: 2025-09-02  
**Sprint Planning**: Ready for immediate execution  
**Estimated Timeline**: 8 weeks (4 sprints)  
**Team Size**: 2-3 developers + 1 DevOps engineer
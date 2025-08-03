# LLM Evaluation Enhancements Implementation Plan

## Overview
This document outlines the detailed implementation plan for adding LLM provider/model selection, CIDAFM behavior modification, and comprehensive evaluation capabilities to the Orchestrator AI system.

## Implementation Phases

### Phase 1: Database Foundation (Days 1-5)

#### Database Schema Changes
```sql
-- Create new tables
CREATE TABLE providers (...);
CREATE TABLE models (...);
CREATE TABLE cidafm_commands (...);
CREATE TABLE user_cidafm_commands (...);
CREATE TABLE user_usage_stats (...);

-- Enhance messages table
ALTER TABLE messages ADD COLUMN provider_id UUID;
-- ... (all other columns from PRD)
```

**Tasks:**
- [ ] Create migration file `20240101000000_add_llm_evaluation_tables.sql`
- [ ] Add RLS policies for all new tables
- [ ] Create seed data for initial providers/models
- [ ] Populate built-in CIDAFM commands
- [ ] Test migration on staging database
- [ ] Update TypeScript types for new schema

**Files to Create/Modify:**
- `supabase/migrations/20240101000000_add_llm_evaluation_tables.sql`
- `lib/types/database.ts`
- `lib/types/llm.ts`
- `lib/types/cidafm.ts`
- `lib/types/evaluation.ts`

### Phase 2: Backend API Foundation (Days 6-10)

#### New API Endpoints
- `GET /api/providers` - List LLM providers
- `GET /api/models` - List models with filtering
- `GET /api/cidafm/commands` - List CIDAFM commands
- `POST /api/cidafm/commands` - Create custom commands
- `GET /api/usage/stats` - Usage analytics
- `POST /api/messages/:id/evaluate` - Message evaluation

#### Enhanced Endpoints
- `POST /api/sessions/:id/messages` - Accept LLM/CIDAFM params
- `GET /api/sessions/:id/messages` - Include evaluation data

**Tasks:**
- [ ] Create LLM provider controller
- [ ] Create CIDAFM commands controller
- [ ] Create evaluation controller
- [ ] Create usage stats controller
- [ ] Enhance messages controller
- [ ] Add request/response DTOs
- [ ] Add validation schemas
- [ ] Update API documentation

**Files to Create/Modify:**
- `pages/api/providers/index.ts`
- `pages/api/models/index.ts`
- `pages/api/cidafm/commands/index.ts`
- `pages/api/usage/stats.ts`
- `pages/api/messages/[id]/evaluate.ts`
- `pages/api/sessions/[id]/messages.ts` (enhance)
- `lib/dto/llm-request.dto.ts`
- `lib/dto/evaluation-request.dto.ts`
- `lib/validations/llm.schema.ts`

### Phase 3: Core Services Enhancement (Days 11-15)

#### LLM Service Enhancements
- Dynamic provider/model selection
- Cost calculation engine
- Token counting integration
- CIDAFM prompt modification

#### New Services
- `CIDAFMService` - Process AFM commands
- `EvaluationService` - Handle ratings and analytics
- `UsageTrackingService` - Calculate usage stats

**Tasks:**
- [ ] Enhance LLMService for dynamic selection
- [ ] Create CIDAFMService with prompt modification
- [ ] Create EvaluationService for ratings
- [ ] Create UsageTrackingService
- [ ] Update OrchestorService to pass LLM preferences
- [ ] Add cost calculation utilities
- [ ] Add token counting utilities
- [ ] Integrate with LangSmith tracking

**Files to Create/Modify:**
- `lib/services/llm.service.ts` (enhance)
- `lib/services/cidafm.service.ts` (new)
- `lib/services/evaluation.service.ts` (new)
- `lib/services/usage-tracking.service.ts` (new)
- `lib/services/orchestrator.service.ts` (enhance)
- `lib/utils/cost-calculator.ts`
- `lib/utils/token-counter.ts`
- `lib/utils/cidafm-processor.ts`

### Phase 4: Frontend Components (Days 16-20)

#### New Components
- `LLMProviderSelector` - Provider selection dropdown
- `LLMModelSelector` - Model selection with pricing
- `CIDAFMControls` - AFM configuration interface
- `MessageEvaluation` - Rating and feedback UI
- `UsageAnalytics` - Analytics dashboard
- `CostEstimator` - Real-time cost display

#### Enhanced Components
- `ChatInput` - Integrate LLM/CIDAFM controls
- `MessageItem` - Add evaluation interface
- `App.vue` - Add analytics navigation

**Tasks:**
- [ ] Create LLM selection components
- [ ] Create CIDAFM controls interface
- [ ] Create evaluation UI components
- [ ] Create usage analytics dashboard
- [ ] Enhance ChatInput with new controls
- [ ] Enhance MessageItem with evaluation
- [ ] Add cost estimation display
- [ ] Create responsive mobile layouts
- [ ] Add loading states and error handling

**Files to Create/Modify:**
- `src/components/LLMProviderSelector.vue`
- `src/components/LLMModelSelector.vue`
- `src/components/CIDAFMControls.vue`
- `src/components/MessageEvaluation.vue`
- `src/components/UsageAnalytics.vue`
- `src/components/CostEstimator.vue`
- `src/components/ChatInput.vue` (enhance)
- `src/components/MessageItem.vue` (enhance)
- `src/views/AnalyticsView.vue`
- `src/App.vue` (enhance)

### Phase 5: State Management & Services (Days 21-25)

#### Pinia Stores
- `useLLMStore` - Manage provider/model selection
- `useCIDAFMStore` - Manage AFM state
- `useEvaluationStore` - Handle evaluation data
- `useUsageStore` - Track usage statistics

#### Frontend Services
- `llmService` - API calls for LLM operations
- `cidafmService` - API calls for CIDAFM operations
- `evaluationService` - API calls for evaluations
- `usageService` - API calls for usage data

**Tasks:**
- [ ] Create LLM Pinia store
- [ ] Create CIDAFM Pinia store
- [ ] Create evaluation Pinia store
- [ ] Create usage Pinia store
- [ ] Enhance message store for new data
- [ ] Create frontend service layer
- [ ] Add offline handling
- [ ] Add optimistic updates
- [ ] Add error recovery

**Files to Create/Modify:**
- `src/stores/llm.ts`
- `src/stores/cidafm.ts`
- `src/stores/evaluation.ts`
- `src/stores/usage.ts`
- `src/stores/messages.ts` (enhance)
- `src/services/llm.service.ts`
- `src/services/cidafm.service.ts`
- `src/services/evaluation.service.ts`
- `src/services/usage.service.ts`

### Phase 6: Integration & Testing (Days 26-30)

#### End-to-End Integration
- Wire frontend to backend APIs
- Test complete user flows
- Performance optimization
- Security validation

#### Testing Strategy
- Unit tests for all new services
- Integration tests for API endpoints
- E2E tests for user workflows
- Load testing for performance

**Tasks:**
- [ ] Complete frontend-backend integration
- [ ] Implement error handling throughout
- [ ] Add comprehensive logging
- [ ] Performance optimization
- [ ] Security audit
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Load testing
- [ ] Bug fixes and polish

**Files to Create/Modify:**
- `tests/unit/services/llm.test.ts`
- `tests/unit/services/cidafm.test.ts`
- `tests/integration/api/providers.test.ts`
- `tests/e2e/llm-selection.spec.ts`
- `tests/e2e/evaluation-flow.spec.ts`
- Various bug fixes across all files

## Technical Implementation Details

### CIDAFM Command Processing

```typescript
interface CIDAFMCommand {
  type: '^' | '&' | '!';
  name: string;
  description: string;
  isActive?: boolean;
}

class CIDAFMProcessor {
  processCommands(message: string, activeState: CIDAFMCommand[]): {
    modifiedPrompt: string;
    newState: CIDAFMCommand[];
    executedCommands: string[];
  }
}
```

### Cost Calculation Engine

```typescript
interface CostCalculation {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  estimatedCost?: number;
}

class CostCalculator {
  calculateCost(
    tokens: { input: number; output: number },
    pricing: { inputPer1k: number; outputPer1k: number }
  ): CostCalculation
}
```

### Message Flow Enhancement

```typescript
interface EnhancedMessage {
  // Existing fields...
  providerId?: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  responseTimeMs?: number;
  langsmithRunId?: string;
  userRating?: number;
  speedRating?: number;
  accuracyRating?: number;
  userNotes?: string;
  evaluationTimestamp?: Date;
  cidafmOptions?: {
    activeStateModifiers: string[];
    responseModifiers: string[];
    executedCommands: string[];
    customOptions?: Record<string, any>;
  };
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
  };
}
```

## Risk Mitigation Strategies

### Database Migration Risks
- **Strategy**: Comprehensive staging testing before production
- **Rollback Plan**: Keep migration reversible with down migrations
- **Monitoring**: Track migration performance and rollback if needed

### Performance Impact
- **Strategy**: Implement caching for provider/model data
- **Monitoring**: Track response time metrics before/after deployment
- **Optimization**: Use database indexes on frequently queried columns

### User Experience Complexity
- **Strategy**: Progressive disclosure - show advanced features only when needed
- **Defaults**: Sensible defaults for provider/model selection
- **Onboarding**: Guided tour for new features

### Cost Management
- **Strategy**: Clear cost estimation before message sending
- **Limits**: Implement spending limits and warnings
- **Transparency**: Show detailed cost breakdowns

## Success Metrics

### Development Metrics
- [ ] All automated tests passing (>95% coverage)
- [ ] Performance regression < 200ms average
- [ ] Zero critical security vulnerabilities
- [ ] Database migration successful in staging

### User Adoption Metrics
- [ ] 80% of users try different LLM providers within 1 week
- [ ] 60% of messages receive evaluation ratings within 2 weeks
- [ ] Average user satisfaction score > 4.0/5.0
- [ ] Zero data loss incidents

### Technical Metrics
- [ ] API response times < 500ms 95th percentile
- [ ] System uptime > 99.9%
- [ ] Cost calculation accuracy within 5%
- [ ] CIDAFM command processing success rate > 99%

## Deployment Strategy

### Staging Deployment
1. Deploy database migrations
2. Deploy backend API changes
3. Deploy frontend changes
4. Run comprehensive testing suite
5. Performance validation

### Production Deployment
1. Database migration during low-traffic window
2. Blue-green deployment for API changes
3. Feature flag rollout for frontend
4. Monitor metrics and rollback if needed
5. Gradual user access increase

### Rollback Plan
- Database: Reversible migrations with down scripts
- API: Previous version containers available for instant rollback  
- Frontend: Feature flags allow instant disable
- Monitoring: Automated alerts trigger rollback procedures

---

*This implementation plan is a living document and will be updated as development progresses.*
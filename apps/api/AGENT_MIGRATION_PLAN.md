# Agent Migration Plan - Centralized LLM Service Optimization

## 📊 Migration Status: 95% Complete ✅

After comprehensive codebase analysis, **agents are already using the centralized LLMService**! However, some services are bypassing intelligent routing with hardcoded providers.

## 🎯 Current State Analysis

### ✅ Already Migrated (No Action Needed)
- **All Agent Base Classes**: Using `LLMService` via dependency injection
- **Agent Services Context**: Provides centralized service to all agents  
- **Python Agents**: Using HTTP calls to centralized service
- **Function Agents**: Using `this.services.llmService.generateResponse()`
- **Context Agents**: Using `this.services.llmService.generateResponse()`
- **API Agents**: Using centralized service
- **External Agents**: Using centralized service

### 🔧 Optimization Needed (Hardcoded Providers)

**Services bypassing intelligent routing with `provider: 'anthropic'`:**

1. **IntentRecognitionService** (`intent-recognition.service.ts:234`)
2. **PlanningService** (13 instances in `planning.service.ts`)
3. **LangGraphStateManagementService** (`langgraph-state-management.service.ts:1227`)
4. **DelegationService** (2 instances in `delegation.service.ts`)

**Impact:** These services bypass our intelligent local/external routing and always use external Anthropic, missing cost savings and performance benefits.

## 🚀 Migration Strategy

### Phase 1: Remove Hardcoded Providers ⚡ (High Priority)

**Goal:** Allow intelligent routing to local models when available

**Services to Update:**
- `intent-recognition.service.ts`
- `planning.service.ts` 
- `langgraph-state-management.service.ts`
- `delegation.service.ts`

**Change Pattern:**
```typescript
// BEFORE (bypasses routing)
const response = await this.llmService.generateResponse(
  systemPrompt,
  userMessage,
  {
    temperature: 0.1,
    maxTokens: 500,
    provider: 'anthropic', // ❌ Hardcoded
    callerType: 'service',
    callerName: 'intent-recognition-service',
    dataClassification: 'internal',
  },
);

// AFTER (allows intelligent routing)
const response = await this.llmService.generateResponse(
  systemPrompt,
  userMessage,
  {
    temperature: 0.1,
    maxTokens: 500,
    // ✅ No provider specified - uses intelligent routing
    callerType: 'service',
    callerName: 'intent-recognition-service',
    dataClassification: 'internal',
    complexity: 'simple', // ✅ Help routing decide local vs external
  },
);
```

### Phase 2: Add Complexity Hints 🎯 (Medium Priority)

**Goal:** Help routing service make better decisions

**Add complexity indicators:**
- `'simple'` - Can use fast local models (llama3.2, qwen3:8b)
- `'medium'` - May need larger models (gpt-oss:20b, qwq)
- `'complex'` - Requires advanced reasoning (external fallback)
- `'reasoning'` - Complex analysis tasks (external preferred)

### Phase 3: Configuration Cleanup 📋 (Low Priority)

**Goal:** Update agent config files to use routing hints instead of hardcoded providers

**Files to update:**
- `agent.config.yaml` files with hardcoded `provider: anthropic`
- Replace with `complexity` and `tier` preferences

## 📋 Detailed Migration Checklist

### ✅ Pre-Migration (Complete)
- [x] Identify all provider client imports ✅ **None found**
- [x] Create inventory of agents requiring migration ✅ **Already migrated**
- [x] Document current functionality ✅ **All using LLMService**
- [x] Identify hardcoded provider configurations ✅ **Found 4 services**

### 🔧 Migration Steps (In Progress)

#### Service Optimization
- [ ] **IntentRecognitionService**: Remove `provider: 'anthropic'`, add `complexity: 'simple'`
- [ ] **PlanningService**: Remove 13 hardcoded providers, add appropriate complexity
- [ ] **LangGraphStateManagementService**: Remove hardcoded provider
- [ ] **DelegationService**: Remove hardcoded providers

#### Testing & Validation
- [ ] Test each service with both local and external routing
- [ ] Verify response quality remains consistent
- [ ] Measure performance improvement with local routing
- [ ] Validate cost savings from local model usage

### 🎯 Success Metrics

**Performance Goals:**
- 50%+ requests routed to local models (cost savings)
- <2s average response time for simple tasks
- Maintain response quality scores >95%

**Cost Goals:**
- 70%+ cost reduction for simple classification tasks
- Maintain external quality for complex reasoning

## 🔍 Testing Strategy

### Unit Tests
```typescript
describe('Service Migration', () => {
  it('should use intelligent routing instead of hardcoded providers', async () => {
    const mockLLMService = createMockLLMService();
    const service = new IntentRecognitionService(mockLLMService);
    
    await service.performLLMIntentClassification(input, context);
    
    // Verify no hardcoded provider
    expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.not.objectContaining({ provider: 'anthropic' })
    );
  });
});
```

### Integration Tests
- Test with Ollama available vs unavailable
- Verify fallback to external providers
- Measure response times and quality

## 🚨 Risk Assessment

**Low Risk Migration:**
- Services already use LLMService
- Only removing hardcoded provider specifications
- Intelligent routing provides automatic fallback
- No breaking changes to agent interfaces

**Rollback Plan:**
- Keep git history of hardcoded providers
- Can quickly revert if quality issues
- Gradual rollout service by service

## 📈 Expected Benefits

**Cost Savings:**
- 60-80% cost reduction for simple tasks using local models
- Estimated $100-500/month savings depending on usage

**Performance:**
- Faster response times for local model tasks
- Better resource utilization
- Reduced external API dependency

**Reliability:**
- Automatic fallback if local models unavailable
- Better error handling and retry logic
- Improved monitoring and alerting

## 🎯 Implementation Order

1. **IntentRecognitionService** (single instance, low risk)
2. **DelegationService** (2 instances, medium usage)  
3. **LangGraphStateManagementService** (single instance, complex)
4. **PlanningService** (13 instances, high impact)

## 📝 Notes

- **Agent architecture is already excellent** - using proper dependency injection
- **Migration is optimization, not overhaul** - removing routing bypasses
- **Backward compatibility maintained** - no breaking changes
- **Gradual rollout possible** - can migrate service by service

# Phase 4: Store Method Migration - Assessment & Strategy

**Date:** 2025-10-17
**Status:** Assessment Complete - Ready for Execution
**Effort:** Architecture Consolidation Phase 4

---

## Executive Summary

Phase 4 aims to eliminate async methods from Pinia stores, enforcing the architectural pattern:
- **Stores** = State + Synchronous Mutations Only
- **Services** = API Calls + Business Logic
- **Actions** = Orchestration (Service → Store)
- **Components** = Call Actions/Services

### Current State

**Total Async Violations:** ~150+ async methods across 20 stores

### Top Violators (by async method count):

| Rank | Store | Async Methods | Priority | Notes |
|------|-------|---------------|----------|-------|
| 1 | `deliverablesStore` | 24 | 🔴 CRITICAL | Core domain model |
| 2 | `analyticsStore` | 19 | 🟡 MEDIUM | Analytics/reporting |
| 3 | `llmMonitoringStore` | 13 | 🟡 MEDIUM | Monitoring/observability |
| 4 | `pseudonymDictionariesStore` | 12 | 🟢 LOW-MED | Privacy (Phase 4.3) |
| 5 | `llmStore` | 10 | 🟡 MEDIUM | LLM management |
| 6 | `adminEvaluationStore` | 8 | 🟢 LOW | Admin features |
| 7 | `piiPatternsStore` | 7 | 🟢 LOW | Privacy (Phase 4.3) |
| 8 | `apiConfigStore` | 7 | 🟡 MEDIUM | API configuration |
| 9 | `pseudonymMappingsStore` | 6 | 🟢 LOW | Privacy (Phase 4.3) |
| 10 | `privacyDashboardStore` | 6 | 🟢 LOW | Privacy (Phase 4.3) |
| 11 | `agentsStore` | 6 | 🔴 HIGH | Core domain model |
| 12 | Other stores | 32 | 🟢 LOW | Various |

---

## Detailed Analysis

### 1. deliverablesStore (24 async methods)

**Status:** Partially migrated - `build.actions.ts` exists but store still has async methods

**Async Methods:**
1. `loadDeliverablesByConversation`
2. `loadDeliverableVersions`
3. `createVersion`
4. `loadDeliverables`
5. `deleteDeliverable`
6. `updateDeliverable`
7. `startEnhancement`
8. `enhanceVersion`
9. `copyVersion`
10. `processAgentDeliverable`
11. `createDeliverable`
12. `getVersions` (alias)
13. `getVersion`
14. `setCurrentVersion` ⚠️ (called by build.actions!)
15. `deleteVersion` ⚠️ (called by build.actions!)
16. `rerunWithDifferentLLM` (HUGE - 200+ lines!)
17. `loadCurrentVersion`
18. `loadStandaloneDeliverables`
19. `createEditingConversation`
20-24. Various helpers

**Components Using Store Async Methods:**
- `DeliverableDisplay.vue` (5 calls to `loadDeliverableVersions`)
- `TwoPaneConversationView.vue` (6 calls to `load*`)
- `AgentTreeView.vue` (1 call)
- `DeliverablesListPage.vue` (3 calls to `loadDeliverables`)

**Existing Infrastructure:**
- ✅ `services/deliverablesService.ts` - exists
- ✅ `services/agent2agent/actions/build.actions.ts` - exists
- ⚠️ Actions layer calling async store methods!

**Recommendation:**
1. Audit `deliverablesService` to ensure all methods exist
2. Remove async methods from store (keep only mutations)
3. Update `build.actions.ts` to call service, not store async methods
4. Update 4 components to use actions/service instead of store
5. Mark old methods as `@deprecated` during transition

---

### 2. agentsStore (6 async methods)

**Status:** Not started

**Async Methods:**
1. `fetchAvailableAgents`
2. `fetchAgentHierarchy`
3. `loadAgent`
4. `loadAgentByName`
5. `refreshAgents`
6. Other helpers

**Existing Infrastructure:**
- Need to check if `agentsService` exists
- No actions layer yet

**Recommendation:**
1. Create `services/agentsService.ts` (if doesn't exist)
2. Move async logic to service
3. Keep only mutations in store
4. Update components

---

### 3. Privacy Stores (Phase 4.3 - Dedicated Task)

**Total:** 31 async methods across 6 stores

**Stores:**
- `pseudonymDictionariesStore` (12 methods)
- `piiPatternsStore` (7 methods)
- `pseudonymMappingsStore` (6 methods)
- `privacyDashboardStore` (6 methods)
- `privacyIndicatorsStore` (3 methods)
- `sovereignPolicyStore` (2 methods)

**Existing Services:**
- `services/piiService.ts`
- `services/pseudonymService.ts`
- `services/sanitizationAnalyticsService.ts`
- `services/sovereignPolicyService.ts`

**Recommendation:**
- Follow Plan Task 4.3 exactly
- Move privacy services to `services/privacy/` folder
- Extract all async methods to services
- Update stores to mutations only

---

### 4. Other Stores (Lower Priority)

**analyticsStore** (19 methods) - Reporting/analytics features
**llmMonitoringStore** (13 methods) - Monitoring/observability
**llmStore** (10 methods) - LLM provider management
**apiConfigStore** (7 methods) - API configuration

**Recommendation:** Address if time permits (Phase 4.4)

---

## Execution Strategy

### Phase 4 Breakdown:

**Task 4.1: Refactor deliverablesStore** (CRITICAL)
- **Time Estimate:** 1-2 days
- **Steps:**
  1. Audit `deliverablesService` for completeness
  2. Mark all async store methods as `@deprecated`
  3. Update `build.actions.ts` to use service only
  4. Update 4 components to use actions/service
  5. Remove async methods from store
  6. Test thoroughly

**Task 4.2: Refactor agentsStore** (HIGH)
- **Time Estimate:** 0.5-1 day
- **Steps:**
  1. Create/verify `agentsService`
  2. Move async methods to service
  3. Update store to mutations only
  4. Update components

**Task 4.3: Refactor Privacy Stores** (MEDIUM - Per Plan)
- **Time Estimate:** 2 days
- **Steps:**
  1. Create `services/privacy/` folder structure
  2. Migrate 4 privacy services to folder
  3. Extract 31 async methods to services
  4. Update 6 stores to mutations only
  5. Update privacy components

**Task 4.4: Refactor Other Stores** (LOW - If Time Permits)
- **Time Estimate:** 0.5 days
- **Focus:** Critical violations only

**Task 4.5: Type-Safety Hardening** (Per Plan)
- **Time Estimate:** 1 day
- **Scope:** Remove `any`, add strict types

---

## Risks & Mitigation

### Risks:

1. **Breaking Changes** - Components depend on store async methods
   - **Mitigation:** Incremental migration, deprecation warnings, thorough testing

2. **Large Scope** - 150+ methods to migrate
   - **Mitigation:** Prioritize by impact (deliverables, agents first)

3. **Partial Migration** - Some stores may stay async
   - **Mitigation:** Accept technical debt on low-priority stores

4. **Test Coverage** - May not catch all regressions
   - **Mitigation:** Manual smoke testing, E2E tests

### Success Criteria:

- ✅ `deliverablesStore` has ZERO async methods
- ✅ `agentsStore` has ZERO async methods
- ✅ All 6 privacy stores have ZERO async methods
- ✅ Components use actions/services instead of store async methods
- ✅ All tests pass
- ✅ Application works end-to-end

---

## Recommendation

**Proceed with Phase 4** using the prioritized approach:

1. ✅ **Task 4.1** - deliverablesStore (CRITICAL) - Start immediately
2. ✅ **Task 4.2** - agentsStore (HIGH) - After 4.1
3. ✅ **Task 4.3** - Privacy Stores (MEDIUM) - After 4.2
4. ⏭️ **Task 4.4** - Other Stores (LOW) - Only if time permits
5. ✅ **Task 4.5** - Type-Safety (HIGH) - After core refactoring

**Estimated Total Time:** 4-6 days (matches PRD estimate of 1 week)

---

## Next Steps

1. Get user approval to proceed with Phase 4.1
2. Begin `deliverablesStore` refactoring
3. Update progress in PLAN.md
4. Commit incrementally (one subtask per commit)
5. Test after each major change

---

**Status:** ✅ Assessment Complete - Awaiting Go-Ahead for Execution

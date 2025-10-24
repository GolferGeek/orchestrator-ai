# Store Architecture Refactoring - Execution Plan

## Overview
This document tracks the execution of the store architecture refactoring to establish clean domain boundaries, strict type safety, and eliminate technical debt. The goal is to make "the simplest things work" by establishing clear contracts and ownership at every layer.

**Core Principle:** Response → Handler (validates/transforms) → Store Action (mutates state) → Vue Reactivity (updates UI)

---

## Store Architecture

### Core Stores (in implementation order)
1. **authStore** - Authentication, user session, permissions (foundation)
2. **conversationStore** - Messages, chat history, context
3. **taskStore** - Task lifecycle, status, execution state
4. **planStore** - Plans and their versions
5. **deliverableStore** - Deliverables/builds and their versions
6. **agentStore** - Agent configurations, capabilities, status
7. **orchestratorStore** - Orchestrations and coordination

---

## Phase 1: Design & Foundation (1-2 days)

### Phase 1.1: Store Interface Design ✅ COMPLETED
- [x] Document authStore interface (state, actions, getters)
- [x] Document conversationStore interface
- [x] Document taskStore interface
- [x] Document planStore interface
- [x] Document deliverableStore interface
- [x] Document agentStore interface
- [x] Document orchestratorStore interface
- [x] Define strict types for all store state/actions
- [x] Create store template/pattern documentation

**Files Created:**
- `/docs/feature/matt/store-interfaces.md` - Complete interface documentation

### Phase 1.2: Handler Refactoring ✅ COMPLETED
- [x] Refactor plan.handler.ts to pure validator/transformer
- [x] Refactor build.handler.ts to pure validator/transformer
- [x] Refactor converse.handler.ts to pure validator/transformer
- [x] Document handler → store action mapping

**Files Updated:**
- `/apps/web/src/services/agent2agent/utils/handlers/plan.handler.ts` - Pure validator pattern
- `/apps/web/src/services/agent2agent/utils/handlers/build.handler.ts` - Pure validator pattern
- `/apps/web/src/services/agent2agent/utils/handlers/converse.handler.ts` - Pure validator pattern

### Phase 1.3: Create Store Implementations ✅ COMPLETED
- [x] Implement authStore with strict types (already existed)
- [x] Implement conversationStore with strict types
- [x] Implement taskStore with strict types
- [x] Implement planStore with strict types
- [x] Implement deliverableStore with strict types
- [x] Implement agentStore with strict types
- [x] Implement orchestratorStore with strict types

**Files Created:**
- `/apps/web/src/stores/conversationStore.ts` - Conversation & message management
- `/apps/web/src/stores/taskStore.ts` - Task lifecycle & execution state
- `/apps/web/src/stores/planStore.ts` - Plans & versions with A2A protocol types
- `/apps/web/src/stores/deliverableStore.ts` - Deliverables/builds & versions
- `/apps/web/src/stores/agentStore.ts` - Agent configurations, capabilities, status
- `/apps/web/src/stores/orchestratorStore.ts` - Orchestration workflow coordination

### Notes
- Each store should use Pinia with composition API (ref, computed, functions)
- All state must use strict types from a2a-protocol
- Actions should be the ONLY way to mutate state
- Getters should be computed() for reactivity

---

## Phase 2: Integration (2-3 days)

### Phase 2.1: Wire Handlers to Store Actions
- [ ] Update plan handlers to call planStore actions
- [ ] Update build handlers to call deliverableStore actions
- [ ] Update converse handlers to call conversationStore actions
- [ ] Document handler → action flow for each mode

### Phase 2.2: Update API Client
- [ ] Refactor agent2agent.api.ts to use new pattern
- [ ] After handler validates: call appropriate store action
- [ ] Remove any manual state mutations from API client
- [ ] Add error handling that updates stores appropriately

### Phase 2.3: Create Store Action Tests
- [ ] Test authStore actions with mock data
- [ ] Test conversationStore actions with mock data
- [ ] Test taskStore actions with mock data
- [ ] Test planStore actions with mock data
- [ ] Test deliverableStore actions with mock data
- [ ] Test agentStore actions with mock data
- [ ] Test orchestratorStore actions with mock data

### Notes
- Pattern: `const data = handler.validate(response); store.action(data);`
- Stores should never call API directly - that's API client's job
- All mutations must go through store actions (no direct state.value = x)

---

## Phase 3: Migration (3-4 days)

### Phase 3.1: Audit Current Store Usage
- [ ] Find all components using old agentChatStore
- [ ] Find all components using old deliverablesStore
- [ ] Find all components using old plansStore/PlansService
- [ ] Document current usage patterns and pain points
- [ ] Create migration checklist per component

### Phase 3.2: Create Migration Adapters (Optional)
- [ ] Evaluate if adapters are needed for gradual migration
- [ ] If needed: create adapter for agentChatStore → new stores
- [ ] If needed: create adapter for old deliverables → deliverableStore
- [ ] Document adapter deprecation timeline

### Phase 3.3: Migrate Core Features
- [ ] Migrate conversation/chat components to conversationStore
- [ ] Migrate plan components to planStore
- [ ] Migrate deliverable components to deliverableStore
- [ ] Migrate agent components to agentStore
- [ ] Update all import paths
- [ ] Test each migration thoroughly

### Phase 3.4: Verify Vue Reactivity
- [ ] Confirm UI updates automatically when stores mutate
- [ ] Remove any manual DOM manipulation or forced updates
- [ ] Verify computed properties update correctly
- [ ] Test watchers and reactive dependencies

### Notes
- Migrate one feature area at a time
- Keep old stores temporarily during migration
- Add console.warn to old stores to track usage
- Test thoroughly before removing old code

---

## Phase 4: Cleanup & Documentation (1-2 days)

### Phase 4.1: Remove Technical Debt
- [ ] Mark old stores as @deprecated
- [ ] Add deprecation warnings to old stores
- [ ] Remove PlansService class (replaced by planStore)
- [ ] Remove duplicate DTOs/types no longer used
- [ ] Delete old agent service classes
- [ ] Remove any unused utilities/helpers

### Phase 4.2: Delete Deprecated Code
- [ ] Delete old agentChatStore
- [ ] Delete old deliverables store/service
- [ ] Delete old plans service
- [ ] Remove migration adapters (if created)
- [ ] Clean up unused imports across codebase

### Phase 4.3: Documentation
- [ ] Create store architecture diagram
- [ ] Document usage examples for each store
- [ ] Create troubleshooting guide
- [ ] Update developer onboarding docs
- [ ] Document the handler → store → UI flow

### Notes
- Keep archive of deleted code in git history
- Document why code was removed (not just what)
- Ensure all team members understand new architecture

---

## Phase 5: Testing & Validation (1 day)

### Phase 5.1: End-to-End Testing
- [ ] Test plan creation flow end-to-end
- [ ] Test build execution flow end-to-end
- [ ] Test conversation flow end-to-end
- [ ] Test orchestration flow end-to-end
- [ ] Verify strict types prevent bad data at all boundaries

### Phase 5.2: Error Scenario Testing
- [ ] Test validation failures in handlers
- [ ] Test network errors in API client
- [ ] Test store error states
- [ ] Verify graceful degradation in all cases
- [ ] Ensure helpful error messages for debugging

### Phase 5.3: Performance Validation
- [ ] Verify no unnecessary re-renders
- [ ] Check Vue reactivity performance
- [ ] Validate store state is minimal (no duplicated data)
- [ ] Ensure computed properties are optimized

### Notes
- All tests should use strict types
- Error messages should be developer-friendly
- Performance should be better than before (fewer manual updates)

---

## Success Criteria

### Must Have
- [ ] Zero TypeScript type errors related to stores
- [ ] Clear data flow: API → Handler → Store → UI
- [ ] No manual UI updates (Vue reactivity handles all)
- [ ] Each store has single responsibility
- [ ] All store actions use strict types from a2a-protocol
- [ ] Exception count significantly reduced

### Should Have
- [ ] Comprehensive documentation
- [ ] Migration guides for team
- [ ] Test coverage for all store actions
- [ ] Performance metrics showing improvement

### Nice to Have
- [ ] Store state debugging tools
- [ ] Vue DevTools integration verified
- [ ] Automated store validation in CI

---

## Completion Criteria

- [ ] All 7 stores implemented with strict types
- [ ] All handlers are pure validators calling store actions
- [ ] All components using new stores (old stores deleted)
- [ ] All tests passing with strict type validation
- [ ] Documentation complete and reviewed
- [ ] Zero technical debt from old implementation
- [ ] "Simplest things work" - basic operations are straightforward

---

## Notes & Decisions Log

### Session Log
*Add timestamped notes here as work progresses*

- **2025-10-05**: Created store-refactor-plan.md
- **2025-10-05**: Completed plan.handler.ts refactoring to pure validator pattern
- **2025-10-05**: User confirmed: "sick of trying to get the simplest things to work because we didn't know what we didn't know"

### Key Architectural Decisions

**Handler → Store Actions Pattern**
- User explicitly requested handlers call into stores (not handlers inside stores)
- Pattern: Response → Handler validates → Store action mutates → Vue reactivity updates UI
- This is the Command Pattern - clear separation of concerns

**Why This Architecture**
- Single Responsibility: Each store owns one domain
- Type Safety: Strict types validate at every boundary
- Testability: Pure handlers, mockable stores
- Predictability: Clear data flow, no surprises
- Scalability: Easy to add new modes/actions

---

## Current Status

**Current Phase:** Phase 1 - COMPLETED ✅
**Last Updated:** 2025-10-05
**Next Task:** Phase 2 - Wire handlers to store actions
**Blockers:** None

### Phase 1 Summary - COMPLETED ✅

**What was accomplished:**
1. ✅ All 3 handlers refactored to pure validators (plan, build, converse)
2. ✅ Complete store interface documentation created
3. ✅ All 6 new stores implemented with strict types:
   - conversationStore - Messages & chat
   - taskStore - Task lifecycle
   - planStore - Plans & versions
   - deliverableStore - Deliverables/builds & versions
   - agentStore - Agent management
   - orchestratorStore - Workflow orchestration

**Key Achievements:**
- All handlers are now pure functions with no side effects
- All stores use strict types from a2a-protocol
- Clear separation: handlers validate, stores mutate
- Maps used for O(1) lookups
- Pinia composition API pattern throughout
- Ready for handler → store integration

# Frontend Store → Services Refactor

## Overview

The agentChatStore was refactored to separate concerns:
- **Store**: Only state management (data storage, getters, simple mutations)
- **Services**: Business logic (conversation, plans, builds, orchestration, task execution)

However, frontend components are still calling old store methods that no longer exist or shouldn't exist. This plan systematically migrates all components to use the new service architecture.

## Current Architecture

### Two Service Layers

**1. Agent Task Services** (`/services/agent-tasks/`) - **USE THESE IN COMPONENTS**
   - **agentTaskService** - Main facade service (recommended)
   - **conversationService** - Converse mode operations
     - `sendConverse(params)` - Send converse message
   - **planService** - Plan mode operations
     - Create, Read, List, Edit, Delete plans
   - **deliverableService** - Build mode operations
     - Create, Read, List, Edit, Delete deliverables
   - **responseHandler** - Handle task responses

**2. Store Helper Services** (`/stores/agentChatStore/`) - For internal store use
   - **conversation** - Store conversation helpers
     - `createConversation(agent)` - Create new conversation
     - `loadConversationMessages(conversationId)` - Load messages
   - **plans** - Store plan helpers (factory)
   - **builds** - Store build helpers (factory)
   - **taskExecution** - Task execution tracking
   - **messageFormatting** - Message display logic

### Store Should Only Have
- State properties (conversations array, activeConversationId, etc.)
- Computed getters (read-only access to state)
- Simple mutations (direct state updates)
- NO business logic methods

## Method Migration Map

| Current Store Method | New Approach | Service/Location | Priority |
|---------------------|--------------|------------------|----------|
| `getActiveConversation()` | Computed property | `store.activeConversation` (computed) | High |
| `sendMessage(content)` | Service method | `agentTaskService.sendTask()` or `conversationService.sendConverse()` | High |
| `sendMessageWithContext(...)` | Service method | `agentTaskService.sendTask()` with metadata | High |
| `sendContextAwareMessage(...)` | Service method | `agentTaskService.sendTask()` with context | High |
| `openExistingConversation(id)` | Store helper + mutation | `conversation.loadConversationMessages()` + `store.setActiveConversation()` | High |
| `switchToConversation(id)` | Store mutation | `store.setActiveConversation(id)` | Medium |
| `closeConversation(id)` | Store mutation | `store.removeConversation(id)` | Medium |
| `setChatMode(mode)` | Store mutation | `store.setChatMode(mode)` or direct state | Low |
| `getActiveChatMode()` | Computed property | `store.activeChatMode` (computed) | Low |
| `setLastMessageWasSpeech(bool)` | Direct state | `store.lastMessageWasSpeech = bool` | Low |
| `setExecutionMode(mode)` | Direct state | `store.executionMode = mode` | Low |
| `resetExecutionMode()` | Direct state | `store.executionMode = null` | Low |
| `getEffectiveExecutionMode()` | Computed property | `store.effectiveExecutionMode` (computed) | Low |
| `clearError(conversationId?)` | Store action | `store.clearError(conversationId)` (already exists) | Low |
| `cancelCurrentOperation()` | Service method | `taskExecution` or `agentTaskService.cancelTask()` | Medium |

## Impact Analysis

### Files Affected (15 total)

**High Priority (Core conversation flow)**
- [ ] `apps/web/src/views/HomePage.vue` - 3 method calls
- [ ] `apps/web/src/views/AgentsPage.vue` - 1 method call (already fixed startNewConversation)
- [ ] `apps/web/src/views/OrganizationPage.vue` - 1 method call (already fixed startNewConversation)
- [ ] `apps/web/src/components/AgentChatView.vue` - 10+ method calls
- [ ] `apps/web/src/components/TwoPaneConversationView.vue` - 4 method calls

**Medium Priority (User interactions)**
- [ ] `apps/web/src/components/ConversationTabs.vue` - 5 method calls
- [ ] `apps/web/src/components/TaskExecutionControls.vue` - 4 method calls
- [ ] `apps/web/src/components/EnhancedChatInput.vue` - 2 method calls
- [ ] `apps/web/src/stores/agentConversationsStore.ts` - 1 method call

**Low Priority (Specialized features)**
- [ ] `apps/web/src/components/SpeechButton.vue` - 3 method calls
- [ ] `apps/web/src/components/ConversationalSpeechButton.vue` - 2 method calls
- [ ] `apps/web/src/components/VersionManagementPanel.vue` - 2 method calls
- [ ] `apps/web/src/components/NewDeliverableDialog.vue` - 1 method call
- [ ] `apps/web/src/components/ProjectDisplay.vue` - 1 method call
- [ ] `apps/web/src/composables/usePrivacyIndicators.ts` - 1 method call

## Implementation Phases

### Phase 1: Define Store Interface ✅ (Investigation)
- [x] Audit all store method calls
- [x] Map methods to services or state
- [x] Create migration plan
- [ ] Review store.ts and document current state structure
- [ ] Define final store interface (state + computed only)

### Phase 2: Create Missing Service Methods
- [ ] Review conversation.ts - identify missing methods
  - [ ] Add `sendMessage(conversationId, content, options)` if missing
  - [ ] Add `sendMessageWithContext(conversationId, content, context)` if missing
  - [ ] Add `loadConversation(conversationId)` if missing
  - [ ] Add `switchConversation(conversationId)` if needed
- [ ] Review taskExecution.ts
  - [ ] Ensure `cancelTask(taskId)` exists
  - [ ] Add `cancelConversationTasks(conversationId)` if needed
- [ ] Create message service if needed
  - [ ] `sendMessage()`
  - [ ] `sendMessageWithContext()`
  - [ ] `sendContextAwareMessage()`
- [ ] Document all service APIs

### Phase 3: Update Store (state only)
- [ ] Remove all business logic methods from store.ts
- [ ] Keep only state properties:
  - `conversations: AgentConversation[]`
  - `activeConversationId: string | null`
  - `chatMode: string`
  - `executionMode: string | null`
  - `lastMessageWasSpeech: boolean`
  - `error: Error | null`
- [ ] Add computed properties:
  - `activeConversation: computed(() => conversations.find(...))`
  - `activeChatMode: computed(() => activeConversation?.chatMode || chatMode)`
  - `effectiveExecutionMode: computed(() => ...)`
- [ ] Add simple mutations (if not using direct state access):
  - `setActiveConversationId(id)`
  - `setChatMode(mode)`
  - `setExecutionMode(mode)`
  - `setLastMessageWasSpeech(bool)`
  - `clearError()`
  - `addConversation(conversation)`
  - `removeConversation(id)`

### Phase 4: Update High Priority Components
- [ ] **HomePage.vue**
  - [ ] Replace `getActiveConversation()` with `agentChatStore.activeConversation`
  - [ ] Replace `openExistingConversation()` with `conversation.loadConversation()`
  - [ ] Replace `switchToConversation()` with state update
  - [ ] Test: Can load and switch between conversations

- [ ] **AgentChatView.vue** (Most complex - 10+ calls)
  - [ ] Replace `getActiveConversation()` with computed `activeConversation`
  - [ ] Replace `getActiveChatMode()` with computed `activeChatMode`
  - [ ] Replace `setChatMode()` with state mutation
  - [ ] Replace `clearError()` with state mutation
  - [ ] Replace `cancelCurrentOperation()` with `taskExecution.cancelTask()`
  - [ ] Test: Can chat, change modes, handle errors

- [ ] **TwoPaneConversationView.vue**
  - [ ] Replace `getActiveChatMode()` with computed
  - [ ] Replace `setChatMode()` with state mutation
  - [ ] Replace `sendMessage()` with `conversation.sendMessage()`
  - [ ] Replace `clearError()` with state mutation
  - [ ] Test: Two-pane view works correctly

- [ ] **AgentsPage.vue** (Already mostly fixed)
  - [ ] Replace `openExistingConversation()` with `conversation.loadConversation()`
  - [ ] Test: Can select agent and start conversation

- [ ] **OrganizationPage.vue** (Already mostly fixed)
  - [ ] Replace `openExistingConversation()` with `conversation.loadConversation()`
  - [ ] Test: Organization page agent selection works

### Phase 5: Update Medium Priority Components
- [ ] **ConversationTabs.vue**
  - [ ] Replace `getActiveConversation()` with computed
  - [ ] Replace `switchToConversation()` with state update
  - [ ] Replace `closeConversation()` with state update + cleanup
  - [ ] Replace `sendMessage()` with service method
  - [ ] Test: Tab switching and closing works

- [ ] **TaskExecutionControls.vue**
  - [ ] Replace `getEffectiveExecutionMode()` with computed
  - [ ] Replace `getActiveConversation()` with computed
  - [ ] Replace `setExecutionMode()` with state mutation
  - [ ] Replace `resetExecutionMode()` with state mutation
  - [ ] Test: Execution mode controls work

- [ ] **EnhancedChatInput.vue**
  - [ ] Replace `getActiveConversation()` with computed
  - [ ] Replace `setChatMode()` with state mutation
  - [ ] Test: Chat input and mode switching works

- [ ] **agentConversationsStore.ts**
  - [ ] Replace `closeConversation()` with proper cleanup
  - [ ] Test: Conversation list management works

### Phase 6: Update Low Priority Components
- [ ] **SpeechButton.vue**
  - [ ] Replace `getActiveConversation()` with computed
  - [ ] Replace `setLastMessageWasSpeech()` with state mutation
  - [ ] Replace `sendMessage()` with service method
  - [ ] Test: Speech input works

- [ ] **ConversationalSpeechButton.vue**
  - [ ] Replace `setLastMessageWasSpeech()` with state mutation
  - [ ] Replace `sendMessage()` with service method
  - [ ] Test: Conversational speech works

- [ ] **VersionManagementPanel.vue**
  - [ ] Replace `sendMessageWithContext()` with service method
  - [ ] Test: Version management panel works

- [ ] **NewDeliverableDialog.vue**
  - [ ] Replace `sendMessageWithContext()` with service method
  - [ ] Test: Creating deliverables works

- [ ] **ProjectDisplay.vue**
  - [ ] Replace `sendContextAwareMessage()` with service method
  - [ ] Test: Project display messaging works

- [ ] **usePrivacyIndicators.ts**
  - [ ] Replace `getActiveConversation()` with computed
  - [ ] Test: Privacy indicators work

### Phase 7: Testing & Cleanup
- [ ] Run full build
- [ ] Test all conversation flows:
  - [ ] Create new conversation
  - [ ] Load existing conversation
  - [ ] Switch between conversations
  - [ ] Close conversations
  - [ ] Send messages in different modes
  - [ ] Change execution modes
  - [ ] Cancel operations
  - [ ] Handle errors
- [ ] Test speech features
- [ ] Test plan/build/deliverable features
- [ ] Remove any unused store methods
- [ ] Update TypeScript types
- [ ] Update documentation

## Success Criteria

- [ ] All components use services for business logic
- [ ] Store only contains state + computed properties
- [ ] No business logic in store
- [ ] All tests pass
- [ ] Build succeeds with no TypeScript errors
- [ ] All conversation flows work end-to-end
- [ ] No console errors in browser

## Notes

### Design Principles
1. **Store**: Data only, no behavior
2. **Services**: Behavior only, minimal state
3. **Components**: Orchestrate services, bind to store state
4. **Composables**: Reusable logic that uses services

### Common Patterns

**Before (OLD - Method calls):**
```typescript
await agentChatStore.sendMessage(content);
const conv = agentChatStore.getActiveConversation();
const mode = agentChatStore.getActiveChatMode();
```

**After (NEW - Services + Reactive State):**
```typescript
import { computed } from 'vue';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { agentTaskService } from '@/services/agent-tasks';

const agentChatStore = useAgentChatStore();

// Reactive computed properties (auto-updates when store changes)
const activeConversation = computed(() => agentChatStore.activeConversation);
const activeChatMode = computed(() => agentChatStore.activeChatMode);

// Or direct access in template (Vue's reactivity handles it)
// In template: {{ agentChatStore.activeConversation }}

// Send messages via service
await agentTaskService.sendTask({
  agentSlug: agentChatStore.activeConversation?.agent.name,
  mode: 'converse',
  userMessage: content,
  conversationId: agentChatStore.activeConversationId,
});
```

**Key Vue Reactivity Principles:**
1. ✅ **DO**: Access store getters directly - they're reactive
   - `agentChatStore.activeConversation` (getter)
   - `agentChatStore.activeChatMode` (getter)
2. ❌ **DON'T**: Call methods to get state
   - ~~`agentChatStore.getActiveConversation()`~~ (old method)
3. ✅ **DO**: Use `computed()` in setup when you need to derive new values
   ```typescript
   const hasMessages = computed(() =>
     agentChatStore.activeConversation?.messages.length > 0
   );
   ```
4. ✅ **DO**: Access directly in templates - Vue handles reactivity
   ```vue
   <template>
     <div v-if="agentChatStore.activeConversation">
       {{ agentChatStore.activeConversation.agent.name }}
     </div>
   </template>
   ```

### Questions to Resolve
- [ ] Should sendMessage be in conversation service or separate message service?
- [ ] How to handle service initialization (factory pattern vs singleton)?
- [ ] Should services have direct access to store or receive context?
- [ ] What's the pattern for service errors → store state updates?

## Progress Tracking

**Phase 1:** ✅ Complete (Investigation)
**Phase 2:** ✅ Complete (Services already exist in `/services/agent-tasks/`)
**Phase 3:** ✅ Complete (Added computed properties to store)
**Phase 4:** ⏳ In Progress (High Priority Components)
**Phase 5:** ⏳ Not Started (Medium Priority Components)
**Phase 6:** ⏳ Not Started (Low Priority Components)
**Phase 7:** ⏳ Not Started (Testing & Cleanup)

**Overall:** 3/7 Phases Complete (43%)

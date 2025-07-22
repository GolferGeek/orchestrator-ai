# Agent Chat Store Refactoring Plan

## Current Issues
- **1,400+ lines** - Too many responsibilities in a single file
- **Mixed concerns** - State management + business logic + UI formatting + WebSocket handling
- **Hard to debug** - Complex interactions between different features
- **Difficult maintenance** - Changes in one area can break others

## Proposed Architecture (Directory-as-Module)

### 🎯 Core Files Structure
```
stores/agentChatStore/               ← Everything agent-chat related
├── index.ts                        (Re-exports: store + services)
├── store.ts                        (~350 lines - Main Pinia store)
├── taskExecution.ts                (~300 lines - Task lifecycle)
├── messageFormatting.ts            (~200 lines - Response formatting)
├── websocketHandler.ts             (~250 lines - WebSocket events)
├── deliverable.ts                  (~150 lines - Deliverable logic)
├── conversation.ts                 (~200 lines - Conversation CRUD)
└── types.ts                        (~100 lines - Shared interfaces)
```

## Import Changes Required
Only **7 files** need import updates:
- `/src/components/TaskExecutionControls.vue`
- `/src/components/SessionSidebar.vue`
- `/src/components/AgentChatView.vue`
- `/src/views/HomePage.vue`
- `/src/components/ConversationTabs.vue`
- `/src/App.vue`
- Plus the store file itself

**Before:** `import { useAgentChatStore } from '@/stores/agentChatStore'`
**After:** `import { useAgentChatStore } from '@/stores/agentChatStore'`

## 📝 Detailed Service Breakdown

### **1. store.ts** (Core State Management)
**Responsibility:** Pure state management with minimal business logic
- **State:** conversations, activeConversationId, globalError
- **Getters:** hasCurrentAgent, hasActiveConversation, canSend
- **Actions:** Basic CRUD (openConversation, switchToConversation, closeConversation)
- **Dependencies:** Services for complex operations

### **2. taskExecution.ts** (Task Lifecycle Management)
**Responsibility:** Handle all task creation and execution modes
- **Methods:**
  - `createAgentTask()` - Task creation with mode detection
  - `handleImmediateMode()` - Immediate execution logic
  - `startPollingMode()` - Polling with message accumulation
  - `startWebSocketMode()` - Real-time subscriptions
  - `determineExecutionMode()` - Mode selection logic
- **Dependencies:** websocketHandler, tasksService

### **3. messageFormatting.ts** (Response Processing)
**Responsibility:** Parse and format agent responses into messages
- **Methods:**
  - `createResponseMessage()` - Parse task response to message
  - `createPlaceholderMessage()` - Generate loading placeholders
  - `extractDeliverableContent()` - Parse various response formats
  - `handleProgressMessages()` - Format progress updates
- **Dependencies:** None (pure functions)

### **4. websocketHandler.ts** (WebSocket Event Management)
**Responsibility:** All WebSocket subscriptions and event handling
- **Methods:**
  - `subscribeToTask()` - Set up task subscriptions
  - `handleTaskCompletion()` - Process completion events
  - `handleWorkflowSteps()` - Process step updates
  - `handleTaskStatus()` - Process status changes
  - `unsubscribeFromTask()` - Cleanup subscriptions
- **Dependencies:** websocketService

### **5. deliverable.ts** (Deliverable Management)
**Responsibility:** Handle deliverable creation and duplicate prevention
- **Methods:**
  - `appendDeliverable()` - Add deliverable with duplicate prevention
  - `checkForDuplicates()` - Comprehensive duplicate detection
  - `formatDeliverable()` - Standardized deliverable formatting
  - `handleMultipleCompletions()` - Manage concurrent completion handlers
- **Dependencies:** None

### **6. conversation.ts** (Conversation Management)
**Responsibility:** Backend conversation persistence and loading
- **Methods:**
  - `createConversation()` - Create in backend
  - `loadConversationMessages()` - Load from backend
  - `updateExecutionModes()` - Sync agent capabilities
  - `persistConversationState()` - Save conversation state
- **Dependencies:** agentConversationsService

### **7. types.ts** (Shared Type Definitions)
**Responsibility:** All interfaces and types used across services
- **Types:**
  - `AgentConversation`, `AgentChatMessage`
  - `TaskExecutionOptions`, `ExecutionMode`
  - `DeliverableOptions`, `ProgressUpdate`
  - Service interfaces and method signatures

## 🔄 Migration Strategy

### **Phase 1: Extract Services (In Progress)**
1. ✅ Create directory structure
2. Create `messageFormatting.ts` - Move response parsing logic
3. Create `deliverable.ts` - Move duplicate prevention logic
4. Update store.ts to use these services
5. Test all execution modes

### **Phase 2: WebSocket & Task Execution**
1. Create `websocketHandler.ts` - Move all WebSocket handling
2. Create `taskExecution.ts` - Move task creation/execution
3. Update store.ts to delegate to these services
4. Test real-time and polling modes

### **Phase 3: Conversation & Cleanup**
1. Create `conversation.ts` - Move backend operations
2. Create `types.ts` - Consolidate type definitions
3. Create `index.ts` with clean exports
4. Update all import statements (7 files)
5. Remove old agentChatStore.ts

### **Phase 4: Testing & Optimization**
1. Comprehensive testing of all execution modes
2. Performance optimization and memory leak prevention
3. Documentation and code cleanup

## ✅ Success Metrics

- **File size reduction:** store.ts: 1,400 → 350 lines (75% reduction)
- **Test coverage:** Each service >90% coverage
- **Performance:** No regression in task execution times
- **Functionality:** All existing features work identically

## 🎯 Benefits

### **Maintainability**
- **Single responsibility** - Each service has one clear purpose
- **Easier debugging** - Issues isolated to specific services
- **Testability** - Services can be unit tested independently

### **Performance**
- **Tree shaking** - Unused services won't be bundled
- **Code splitting** - Services can be loaded on demand
- **Memory efficiency** - Better garbage collection

### **Developer Experience**
- **Clear interfaces** - Well-defined service boundaries
- **Reusability** - Services can be used in other contexts
- **Type safety** - Comprehensive TypeScript interfaces

---

**Status:** Phase 1 started
**Last Updated:** 2025-07-22
**Context:** WebSocket duplicate issue resolved, ready for refactoring
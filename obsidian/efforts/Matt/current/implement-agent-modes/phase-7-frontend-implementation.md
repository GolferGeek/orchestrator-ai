# Phase 7: Frontend Implementation (Vue/Ionic)

**Status**: 🟡 Not Started
**Assignee**: Cursor (Dev) → Claude (Test/Commit)
**Duration**: 8-12 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 6 Complete

---

## Objective

Enhance existing Vue/Ionic components to support backend agent modes. **Good news**: Most UI already exists! We need to wire up the backend integration and add plan_structure handling.

---

## Current State Assessment

✅ **Already Implemented**:
- `ChatModeControl.vue` - Mode selector dropdown (converse/plan/build)
- `ChatModeSendButton.vue` - Send button with mode icons and quick-switch popover
- `agentChatStore` - State management for mode selection
- Mode switching UI with analytics tracking

❌ **Missing**:
- Backend integration (modes not sent to API yet)
- `plan_structure` detection (disable Plan if agent has no plan_structure)
- Mode indicator in chat header
- Keyboard shortcuts (Ctrl+T/P/B)
- Loading states per mode

---

## Development Tasks

### Task 1: Update Agent Type to Include plan_structure
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Add `plan_structure`, `deliverable_structure`, `io_schema` to Agent type

**Files**:
- `apps/web/src/types/agent.ts` (or wherever Agent type is defined)
- `apps/web/src/stores/agentChatStore/types.ts` (if Agent defined there)

**Acceptance Criteria**:
- [ ] Agent interface includes `plan_structure?: any`
- [ ] Agent interface includes `deliverable_structure?: any`
- [ ] Agent interface includes `io_schema?: any`
- [ ] TypeScript compiles without errors

**Implementation**:
```typescript
// In agent type definition
export interface Agent {
  id: string;
  slug: string;
  name: string;
  agent_type: 'context' | 'api' | 'function' | 'orchestrator';
  // ... existing fields

  // NEW FIELDS:
  plan_structure?: Record<string, any>; // JSON Schema for plans
  deliverable_structure?: Record<string, any>; // JSON Schema for deliverables
  io_schema?: {
    input?: Record<string, any>;
    output?: Record<string, any>;
  };
}
```

**Notes**:


**Log**:


---

### Task 2: Update ChatModeControl to Disable Plan if No plan_structure
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Enhance `ChatModeControl.vue` to check agent.plan_structure

**Files**: `apps/web/src/components/ChatModeControl.vue`

**Acceptance Criteria**:
- [ ] Plan mode disabled if `agent.plan_structure === null`
- [ ] Tooltip shows "This agent does not support planning"
- [ ] allowedChatModes computed based on agent capabilities
- [ ] Existing analytics tracking preserved

**Implementation**:
```vue
<script setup lang="ts">
// ... existing imports

const selectableModes = computed(() => {
  const conv = chatStore.getActiveConversation();
  const agent = conv?.agent;

  // Filter based on agent capabilities
  let allowed = conv?.allowedChatModes?.length ? conv.allowedChatModes : DEFAULT_CHAT_MODES;

  // Remove 'plan' if agent has no plan_structure
  if (agent && !agent.plan_structure) {
    allowed = allowed.filter(mode => mode !== 'plan');
  }

  return modeOptions.filter(option => allowed.includes(option.value));
});

// ... rest of component
</script>
```

**Notes**:


**Log**:


---

### Task 3: Update ChatModeSendButton to Respect plan_structure
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Update `ChatModeSendButton.vue` to filter modes based on agent

**Files**: `apps/web/src/components/ChatModeSendButton.vue`

**Acceptance Criteria**:
- [ ] Plan mode not shown in popover if agent has no plan_structure
- [ ] Existing mode icons and descriptions preserved
- [ ] Send functionality preserved

**Implementation**:
```vue
<script setup lang="ts">
// ... existing code

const modes = computed(() => {
  const conversation = chatStore.getActiveConversation();
  const agent = conversation?.agent;

  let filtered = baseModes.filter(mode => allowedModes.value.includes(mode.value));

  // Remove plan mode if agent doesn't support it
  if (agent && !agent.plan_structure) {
    filtered = filtered.filter(m => m.value !== 'plan');
  }

  return filtered;
});

// ... rest of component
</script>
```

**Notes**:


**Log**:


---

### Task 4: Add Keyboard Shortcuts Composable
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Create `useKeyboardShortcuts` composable for Ctrl+T/P/B

**Files**: `apps/web/src/composables/useKeyboardShortcuts.ts` (new file)

**Acceptance Criteria**:
- [ ] Supports Ctrl/Cmd + key combinations
- [ ] Prevents conflicts with browser shortcuts
- [ ] Handles focus state (don't trigger when typing)
- [ ] Cleans up event listeners on unmount
- [ ] ~60 lines

**Implementation**:
```typescript
import { onMounted, onUnmounted } from 'vue';

interface ShortcutOptions {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: ShortcutOptions = {}
) {
  const handler = (event: KeyboardEvent) => {
    // Check key matches
    if (event.key.toLowerCase() !== key.toLowerCase()) return;

    // Check modifiers
    if (options.ctrl && !(event.ctrlKey || event.metaKey)) return;
    if (options.shift && !event.shiftKey) return;
    if (options.alt && !event.altKey) return;

    // Don't trigger if user is typing in input
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
      return;
    }

    event.preventDefault();
    callback();
  };

  onMounted(() => {
    window.addEventListener('keydown', handler);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handler);
  });
}

export function useModeSwitchShortcuts(chatStore: any) {
  useKeyboardShortcut('t', () => {
    chatStore.setChatMode('converse');
  }, { ctrl: true });

  useKeyboardShortcut('p', () => {
    const conv = chatStore.getActiveConversation();
    if (conv?.agent?.plan_structure) {
      chatStore.setChatMode('plan');
    }
  }, { ctrl: true });

  useKeyboardShortcut('b', () => {
    chatStore.setChatMode('build');
  }, { ctrl: true });
}
```

**Notes**:


**Log**:


---

### Task 5: Add Keyboard Shortcuts to Chat Component
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Use keyboard shortcuts in main chat view

**Files**: `apps/web/src/views/ChatView.vue` (or wherever main chat is)

**Acceptance Criteria**:
- [ ] Import and use `useModeSwitchShortcuts`
- [ ] Shortcuts work across chat view
- [ ] Visual feedback when shortcut triggered

**Implementation**:
```vue
<script setup lang="ts">
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useModeSwitchShortcuts } from '@/composables/useKeyboardShortcuts';

const chatStore = useAgentChatStore();

// Enable keyboard shortcuts
useModeSwitchShortcuts(chatStore);

// ... rest of component
</script>
```

**Notes**:


**Log**:


---

### Task 6: Add Mode Indicator to Chat Header
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Show current mode in chat header with icon

**Files**: `apps/web/src/components/ChatHeader.vue` (or create if doesn't exist)

**Acceptance Criteria**:
- [ ] Shows icon + label for current mode (💬 Talking / 📋 Planning / 🔨 Building)
- [ ] Updates in real-time as mode changes
- [ ] Shows agent capabilities badge if no plan_structure
- [ ] ~80 lines

**Implementation**:
```vue
<template>
  <div class="chat-header">
    <div class="agent-info">
      <h2>{{ agent?.name }}</h2>
      <span v-if="!agent?.plan_structure" class="badge conversation-only">
        💬 Conversation Only
      </span>
    </div>

    <div class="mode-indicator" :class="`mode-${currentMode}`">
      <ion-icon :icon="modeIcon"></ion-icon>
      <span>{{ modeLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { chatbubblesOutline, documentTextOutline, hammerOutline } from 'ionicons/icons';
import { useAgentChatStore } from '@/stores/agentChatStore';

const chatStore = useAgentChatStore();

const agent = computed(() => chatStore.getActiveConversation()?.agent);
const currentMode = computed(() => chatStore.getActiveChatMode());

const modeConfig = {
  converse: { icon: chatbubblesOutline, label: 'Talking', color: 'primary' },
  plan: { icon: documentTextOutline, label: 'Planning', color: 'secondary' },
  build: { icon: hammerOutline, label: 'Building', color: 'tertiary' },
};

const modeIcon = computed(() => modeConfig[currentMode.value]?.icon || chatbubblesOutline);
const modeLabel = computed(() => modeConfig[currentMode.value]?.label || 'Talking');
</script>

<style scoped>
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light);
}

.agent-info h2 {
  margin: 0;
  font-size: 1.1em;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
  margin-left: 8px;
}

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.9em;
  font-weight: 500;
}

.mode-converse { background: rgba(var(--ion-color-primary-rgb), 0.1); color: var(--ion-color-primary); }
.mode-plan { background: rgba(var(--ion-color-secondary-rgb), 0.1); color: var(--ion-color-secondary); }
.mode-build { background: rgba(var(--ion-color-tertiary-rgb), 0.1); color: var(--ion-color-tertiary); }
</style>
```

**Notes**:


**Log**:


---

### Task 7: Update API Integration to Send Mode
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Update chat API calls to include `mode` from store

**Files**:
- `apps/web/src/services/agentChatService.ts` (or wherever API calls are)
- `apps/web/src/stores/agentChatStore/actions.ts` (if store handles API calls)

**Acceptance Criteria**:
- [ ] Send requests include `mode` field from `chatStore.getActiveChatMode()`
- [ ] Mode matches transport-types: 'converse' | 'plan' | 'build'
- [ ] Payload structure matches PlanModePayload / BuildModePayload when needed
- [ ] Existing API calls preserved

**Implementation**:
```typescript
// In API service
export async function sendMessage(conversationId: string, message: string) {
  const chatStore = useAgentChatStore();
  const mode = chatStore.getActiveChatMode();

  const request = {
    agentSlug: chatStore.getActiveConversation()?.agent?.slug,
    mode: mode, // 'converse' | 'plan' | 'build'
    userMessage: message,
    conversationId: conversationId,
    sessionId: chatStore.getSessionId(),
    payload: buildPayloadForMode(mode), // Creates appropriate payload
  };

  return await api.post('/api/a2a/task', request);
}

function buildPayloadForMode(mode: string) {
  switch (mode) {
    case 'plan':
      return { action: 'create' }; // Default plan action
    case 'build':
      return { action: 'create' }; // Default build action
    default:
      return {}; // Converse has no action
  }
}
```

**Notes**:


**Log**:


---

### Task 8: Add Loading States by Mode
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Show appropriate loading indicator based on mode

**Files**: Chat message loading component

**Acceptance Criteria**:
- [ ] CONVERSE: "Agent is typing..."
- [ ] PLAN: "Creating plan..." or "Updating plan..."
- [ ] BUILD: "Building deliverable..." with cancel button
- [ ] Loading state from store: `chatStore.isLoading` and `chatStore.currentOperation`

**Implementation**:
```vue
<template>
  <div v-if="isLoading" class="loading-indicator">
    <ion-spinner name="dots"></ion-spinner>
    <span>{{ loadingMessage }}</span>
    <ion-button v-if="currentMode === 'build'" @click="cancel" size="small" fill="outline">
      Cancel
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonSpinner, IonButton } from '@ionic/vue';
import { useAgentChatStore } from '@/stores/agentChatStore';

const chatStore = useAgentChatStore();

const isLoading = computed(() => chatStore.isLoading);
const currentMode = computed(() => chatStore.getActiveChatMode());

const loadingMessage = computed(() => {
  switch (currentMode.value) {
    case 'converse':
      return 'Agent is typing...';
    case 'plan':
      return 'Creating plan...';
    case 'build':
      return 'Building deliverable...';
    default:
      return 'Processing...';
  }
});

function cancel() {
  chatStore.cancelCurrentOperation();
}
</script>
```

**Notes**:


**Log**:


---

## Testing Tasks

### Test 1: Verify TypeScript Compilation
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Ensure all type changes compile

**Test Steps**:
```bash
cd apps/web
npm run type-check
# or
npx vue-tsc --noEmit
```

**Expected Results**:
- No TypeScript errors
- Agent types include new fields

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: Manual UI Test - Mode Selection
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test existing mode selector with backend

**Test Steps**:
1. Start web app on port 7101 or 7102
2. Open chat with blog-post-writer agent
3. Use `ChatModeControl` dropdown to switch modes
4. Verify mode updates in store
5. Test `ChatModeSendButton` popover
6. Verify mode switches

**Expected Results**:
- Mode selector works
- Mode persists in store
- Send button shows correct mode icon

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: Manual UI Test - Keyboard Shortcuts
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test Ctrl+T/P/B shortcuts

**Test Steps**:
1. Press Ctrl+T - verify mode switches to Converse
2. Press Ctrl+P - verify mode switches to Plan (if available)
3. Press Ctrl+B - verify mode switches to Build
4. Type in message box and press Ctrl+T - verify shortcut doesn't trigger

**Expected Results**:
- All shortcuts work
- Don't trigger when typing
- Visual feedback in mode selector

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: Manual UI Test - Agent Without plan_structure
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test with agent that has no plan_structure

**Test Steps**:
1. Open chat with agent where plan_structure = null
2. Verify Plan mode not shown in `ChatModeControl` dropdown
3. Verify Plan mode not shown in `ChatModeSendButton` popover
4. Verify "Conversation Only" badge shown in header
5. Verify Ctrl+P shortcut does nothing

**Expected Results**:
- Plan mode completely hidden
- Badge indicates conversation-only
- Converse and Build modes work

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: Manual UI Test - Mode Indicator
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test chat header mode indicator

**Test Steps**:
1. Switch to Converse mode - verify header shows "💬 Talking"
2. Switch to Plan mode - verify header shows "📋 Planning"
3. Switch to Build mode - verify header shows "🔨 Building"
4. Verify colors match mode

**Expected Results**:
- Header updates in real-time
- Correct icon and label for each mode
- Visual styling distinct per mode

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 6: Manual UI Test - Backend Integration
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify API requests include mode

**Test Steps**:
1. Open browser dev tools → Network tab
2. Switch to Converse mode
3. Send message
4. Inspect request payload - verify `mode: 'converse'`
5. Switch to Plan mode
6. Send message
7. Inspect request payload - verify `mode: 'plan'` and `payload: {action: 'create'}`
8. Switch to Build mode
9. Send message
10. Inspect request - verify `mode: 'build'` and `payload: {action: 'create'}`

**Expected Results**:
- All requests include `mode` field
- Mode matches selected mode
- Payload structure correct for each mode

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 7: Manual UI Test - Loading States
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify loading indicators show correctly

**Test Steps**:
1. Send Converse message - verify "Agent is typing..."
2. Send Plan message - verify "Creating plan..."
3. Send Build message - verify "Building deliverable..." with cancel button

**Expected Results**:
- Appropriate message for each mode
- Cancel button only on Build mode
- Spinner shows during loading

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Commit Checklist

**Assignee**: Claude

- [ ] All development tasks completed
- [ ] TypeScript compiles without errors
- [ ] All manual UI tests passing (7)
- [ ] Keyboard shortcuts working
- [ ] Mode indicator working
- [ ] Backend integration verified
- [ ] plan_structure handling correct
- [ ] Ready to commit

**Commit Message**:
```
feat(web): integrate backend agent modes with Vue/Ionic UI

- Add plan_structure, deliverable_structure, io_schema to Agent type
- Update ChatModeControl to disable Plan if no plan_structure
- Update ChatModeSendButton to respect agent capabilities
- Add useKeyboardShortcuts composable for Ctrl+T/P/B
- Add ChatHeader mode indicator component
- Update API calls to send mode with requests
- Add mode-specific loading states
- Show "Conversation Only" badge for agents without planning

Existing UI components enhanced, backend fully integrated!

Refs: implement-agent-modes Phase 7
```

**Commit Status**: ⬜ Not Committed

---

## Phase 7 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Ready for Phase 8**: ⬜ Yes / ⬜ No

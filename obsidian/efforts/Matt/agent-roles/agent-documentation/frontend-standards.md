# Frontend Standards and Practices

## Architecture Overview

The frontend follows a strict **service-oriented architecture** with clear separation of concerns:

```
Components (Vue/Ionic)
    ↓
Services (Business Logic)
    ↓
Transport Types (API Contract)
    ↓
Backend (A2A Protocol)

Stores (State Only) ← Updated by Services
    ↓
Components (Read State via Vue Reactivity - AUTO UPDATES UI)
```

**Key Concept: Vue Reactivity**
- When services update store state via mutations, Vue's reactivity system automatically updates the UI
- Components don't need to manually refresh or re-render
- Store mutations trigger reactive updates throughout the component tree
- This is the power of Vue 3's Composition API with Pinia stores

## Core Principles

### 1. Separation of Concerns

**Store = State Only**
- Stores contain ONLY reactive data
- NO business logic
- NO API calls
- NO async operations
- ONLY simple, synchronous mutations

**Services = Business Logic**
- Services handle ALL business logic
- Services make API calls
- Services process responses
- Services update stores via simple mutations
- Services are stateless

**Components = UI Only**
- Components render UI
- Components handle user interactions
- Components call services (not APIs directly)
- Components read from stores (not mutate directly)

### 2. Transport Types are Sacred

**NEVER modify transport types**
- Transport types define the API contract
- Frontend and backend must agree on transport types
- Transport types live in `@orchestrator-ai/transport-types` package
- ANY change to transport requires updating the package
- NO custom payload modifications in frontend code
- NO custom payload modifications in backend code

**Always use transport types**
```typescript
// ✅ CORRECT
import { AgentTaskMode, BuildAction, BuildCreatePayload } from '@orchestrator-ai/transport-types';

const payload: BuildCreatePayload = {
  action: 'create',
  title: 'My Deliverable',
  // ... other fields from BuildCreatePayload
};

// ❌ WRONG - custom payload
const payload = {
  action: 'create',
  title: 'My Deliverable',
  customField: 'value' // NOT in transport types!
};
```

### 3. A2A Protocol Compliance

All agent-to-agent communication follows **JSON-RPC 2.0** format:

**Request Format:**
```typescript
{
  jsonrpc: "2.0",
  method: "converse" | "plan" | "build" | "orchestrate",
  id: "task-uuid",
  params: {
    conversationId: string,
    userMessage: string,
    messages: Array<{role, content}>,
    mode: AgentTaskMode,
    payload: {
      // Mode-specific payload from transport types
    },
    metadata: {
      // Additional metadata
    }
  }
}
```

**Response Format:**
```typescript
{
  success: boolean,
  mode: AgentTaskMode,
  payload: {
    content: {
      // Mode-specific content from transport types
    },
    metadata: {
      // Response metadata from transport types
    }
  }
}
```

**DO NOT deviate from this format!**

---

## Service Layer Standards

### Service Structure

Each service handles one mode:
- `conversationService.ts` - Handles CONVERSE mode
- `planService.ts` - Handles PLAN mode with actions
- `deliverableService.ts` - Handles BUILD mode with actions
- `orchestrationService.ts` - Handles ORCHESTRATE mode with actions

### Service Pattern

```typescript
// Example: planService.ts
import {
  AgentTaskMode,
  PlanAction,
  PlanCreatePayload,
  PlanReadPayload,
  // ... other types
} from '@orchestrator-ai/transport-types';
import { useLLMStore } from '@/stores/llmStore';
import { useAgentChatStore } from '@/stores/agentChatStore';
import tasksService from '@/services/tasksService';

export const planService = {
  /**
   * Route plan action to appropriate handler
   */
  async handleAction(action: PlanAction, params: any) {
    switch (action) {
      case 'create':
        return this.create(params);
      case 'read':
        return this.read(params);
      case 'edit':
        return this.edit(params);
      // ... other actions
      default:
        throw new Error(`Unknown plan action: ${action}`);
    }
  },

  /**
   * Create a new plan
   */
  async create(params: {
    conversationId: string;
    message: string;
    title?: string;
  }) {
    const llmStore = useLLMStore();
    const chatStore = useAgentChatStore();

    // Build payload using transport types
    const payload: PlanCreatePayload = {
      action: 'create',
      title: params.title,
      // LLM config from LLM store
      config: {
        provider: llmStore.selectedProvider,
        model: llmStore.selectedModel,
        temperature: llmStore.temperature,
        maxTokens: llmStore.maxTokens,
      },
    };

    // Call backend
    const response = await tasksService.createAgentTask(
      'context',
      chatStore.activeAgent.name,
      {
        method: 'plan',
        prompt: params.message,
        conversationId: params.conversationId,
        conversationHistory: chatStore.getConversationHistory(params.conversationId),
        params: {
          mode: AgentTaskMode.PLAN,
          payload: payload,
        }
      }
    );

    // Process response
    return this.handleResponse(response);
  },

  /**
   * Handle plan response (success or error)
   */
  handleResponse(response: any) {
    if (!response.success) {
      return this.handleError(response);
    }
    return this.handleSuccess(response);
  },

  /**
   * Handle successful plan response
   */
  handleSuccess(response: any) {
    const chatStore = useAgentChatStore();

    // Extract plan data from response
    const planId = response.payload?.content?.plan?.id;
    const plan = response.payload?.content?.plan;

    // Update store with simple mutations
    // Vue reactivity automatically updates the UI!
    if (planId && plan) {
      chatStore.setPlan(response.conversationId, plan);
    }

    // Extract and add message
    // Vue reactivity automatically updates the UI!
    const message = response.payload?.content?.message;
    if (message) {
      chatStore.addMessage(response.conversationId, {
        id: `plan-${Date.now()}`,
        role: 'assistant',
        content: message,
        planId: planId,
        timestamp: new Date(),
      });
    }

    return response;
  },

  /**
   * Handle plan error response
   */
  handleError(response: any) {
    const chatStore = useAgentChatStore();

    const errorMessage = response.payload?.metadata?.reason || 'Plan creation failed';

    chatStore.setError(response.conversationId, errorMessage);

    throw new Error(errorMessage);
  },

  // ... other action handlers (read, edit, etc.)
};
```

### Key Service Rules

1. **Services are stateless** - no internal state, only operate on parameters
2. **Services use transport types** - all payloads must match transport types
3. **Services update store via mutations** - call simple store methods, don't mutate directly
4. **Services handle errors** - catch, log, and throw with meaningful messages
5. **Services return responses** - always return the response for caller to use if needed

---

## Store Standards

### Store Structure

```typescript
// store.ts - STATE ONLY
import { defineStore } from 'pinia';

export const useAgentChatStore = defineStore('agentChat', {
  state: () => ({
    conversations: [] as AgentConversation[],
    activeConversationId: null as string | null,
  }),

  getters: {
    // Simple getters only - no complex logic
    activeConversation(state) {
      return state.conversations.find(c => c.id === state.activeConversationId);
    },

    getConversationById: (state) => (id: string) => {
      return state.conversations.find(c => c.id === id);
    },
  },

  actions: {
    // ONLY simple, synchronous mutations

    setActiveConversation(id: string) {
      this.activeConversationId = id;
    },

    addConversation(conversation: AgentConversation) {
      this.conversations.push(conversation);
    },

    addMessage(conversationId: string, message: AgentChatMessage) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        conv.messages.push(message);
      }
    },

    setPlan(conversationId: string, plan: any) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        conv.currentPlan = plan;
        conv.latestPlanId = plan.id;
      }
    },

    setDeliverable(conversationId: string, deliverable: any) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        conv.currentDeliverable = deliverable;
      }
    },

    setError(conversationId: string, error: string) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        conv.error = error;
      }
    },

    clearError(conversationId: string) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        conv.error = null;
      }
    },
  },
});
```

### Store Anti-Patterns (DON'T DO THIS)

❌ **NO async operations in store**
```typescript
// WRONG
async sendMessage(text: string) {
  const response = await apiService.post(...);
  this.messages.push(response.message);
}
```

❌ **NO business logic in store**
```typescript
// WRONG
processResponse(response: any) {
  if (response.mode === 'plan') {
    const plan = this.extractPlan(response);
    this.validatePlan(plan);
    this.savePlan(plan);
  }
}
```

❌ **NO API calls in store**
```typescript
// WRONG
async loadConversation(id: string) {
  const data = await fetch(`/api/conversations/${id}`);
  this.conversation = data;
}
```

✅ **DO: Simple synchronous mutations**
```typescript
// CORRECT
setConversation(conversation: AgentConversation) {
  const existing = this.conversations.find(c => c.id === conversation.id);
  if (existing) {
    Object.assign(existing, conversation);
  } else {
    this.conversations.push(conversation);
  }
}
```

---

## Component Standards

### Component Structure

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { agentTaskService } from '@/services/agent-tasks';
import { AgentTaskMode } from '@orchestrator-ai/transport-types';

// Store access (read-only)
const chatStore = useAgentChatStore();

// Computed from store
const activeConversation = computed(() => chatStore.activeConversation);
const messages = computed(() => activeConversation.value?.messages || []);

// Local component state
const newMessage = ref('');
const isSending = ref(false);

// Business logic via services
async function sendMessage() {
  if (!activeConversation.value || !newMessage.value.trim()) return;

  isSending.value = true;

  try {
    await agentTaskService.sendTask({
      mode: AgentTaskMode.CONVERSE,
      conversationId: activeConversation.value.id,
      message: newMessage.value,
    });

    newMessage.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
    // Show error to user
  } finally {
    isSending.value = false;
  }
}

async function createPlan() {
  if (!activeConversation.value) return;

  try {
    await agentTaskService.sendTask({
      mode: AgentTaskMode.PLAN,
      action: 'create',
      conversationId: activeConversation.value.id,
      message: 'Create a plan',
    });
  } catch (error) {
    console.error('Failed to create plan:', error);
  }
}
</script>

<template>
  <div class="chat-view">
    <!-- Render messages from store -->
    <div v-for="msg in messages" :key="msg.id">
      {{ msg.content }}
    </div>

    <!-- Input -->
    <input v-model="newMessage" @keyup.enter="sendMessage" />
    <button @click="sendMessage" :disabled="isSending">Send</button>
    <button @click="createPlan">Create Plan</button>
  </div>
</template>
```

### Component Rules

1. **Components use services for business logic** - never call APIs directly
2. **Components read from stores** - use computed properties
3. **Components don't mutate store directly** - services do that
4. **Components handle UI state** - loading, form validation, etc.
5. **Components show errors** - display user-friendly error messages

---

## Request Building Standards

### Building Requests

Always use transport types when building requests:

```typescript
import {
  AgentTaskMode,
  BuildAction,
  BuildCreatePayload
} from '@orchestrator-ai/transport-types';

// ✅ CORRECT - using transport types
const payload: BuildCreatePayload = {
  action: 'create',
  title: 'My Deliverable',
  type: 'document',
  config: {
    provider: llmStore.selectedProvider,
    model: llmStore.selectedModel,
  },
};

const taskOptions = {
  method: 'build',
  prompt: userMessage,
  conversationId: conversationId,
  conversationHistory: messages,
  params: {
    mode: AgentTaskMode.BUILD,
    payload: payload,
  },
};

await tasksService.createAgentTask(agentType, agentName, taskOptions);
```

### LLM Configuration

Always include LLM configuration from the LLM store:

```typescript
const llmStore = useLLMStore();

const payload = {
  action: 'create',
  config: {
    provider: llmStore.selectedProvider,  // Required
    model: llmStore.selectedModel,        // Required
    temperature: llmStore.temperature,    // Optional
    maxTokens: llmStore.maxTokens,        // Optional
  },
};
```

**NEVER use fallbacks** - if provider/model not set, throw error:
```typescript
if (!llmStore.selectedProvider || !llmStore.selectedModel) {
  throw new Error('LLM provider and model must be selected');
}
```

---

## Response Handling Standards

### Processing Responses

Responses come back in transport type format:

```typescript
interface TaskResponse {
  success: boolean;
  mode: AgentTaskMode;
  payload: {
    content: any;      // Mode-specific content
    metadata: any;     // Mode-specific metadata
  };
}
```

### Response Handler Pattern

```typescript
export const responseHandler = {
  handleTaskResponse(response: TaskResponse) {
    // Route based on mode
    switch (response.mode) {
      case AgentTaskMode.CONVERSE:
        return conversationService.handleResponse(response);
      case AgentTaskMode.PLAN:
        return planService.handleResponse(response);
      case AgentTaskMode.BUILD:
        return deliverableService.handleResponse(response);
      case AgentTaskMode.ORCHESTRATE_EXECUTE:
        return orchestrationService.handleResponse(response);
      default:
        throw new Error(`Unknown mode: ${response.mode}`);
    }
  }
};
```

### Extracting Data from Responses

Use transport types to know what fields are available:

```typescript
// Plan response
if (response.mode === AgentTaskMode.PLAN && response.success) {
  const planId = response.payload.content.plan?.id;
  const plan = response.payload.content.plan;
  const message = response.payload.metadata.message;

  // Update store
  chatStore.setPlan(conversationId, plan);
  chatStore.addMessage(conversationId, {
    role: 'assistant',
    content: message,
    planId: planId,
  });
}
```

---

## Common Patterns

### Pattern: Send Task with Action

```typescript
// For modes with actions (plan, build, orchestrate)
await agentTaskService.sendTask({
  mode: AgentTaskMode.PLAN,
  action: 'create',  // PlanAction
  conversationId: id,
  message: text,
});
```

### Pattern: Send Task without Action

```typescript
// For converse mode (no actions)
await agentTaskService.sendTask({
  mode: AgentTaskMode.CONVERSE,
  conversationId: id,
  message: text,
});
```

### Pattern: Handle Success/Error

```typescript
try {
  const result = await agentTaskService.sendTask({...});
  // Success - store already updated by service
  showSuccessMessage();
} catch (error) {
  // Error - service already set error in store
  showErrorMessage(error.message);
}
```

---

## Testing Standards

### Unit Tests for Services

```typescript
describe('planService', () => {
  it('should build correct payload for create action', async () => {
    const params = {
      conversationId: 'conv-123',
      message: 'Create a plan',
      title: 'My Plan',
    };

    const spy = vi.spyOn(tasksService, 'createAgentTask');

    await planService.create(params);

    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          mode: AgentTaskMode.PLAN,
          payload: expect.objectContaining({
            action: 'create',
            title: 'My Plan',
          }),
        }),
      }),
    );
  });
});
```

### Integration Tests

```typescript
describe('Conversation flow', () => {
  it('should send message and update store', async () => {
    const chatStore = useAgentChatStore();

    await agentTaskService.sendTask({
      mode: AgentTaskMode.CONVERSE,
      conversationId: 'conv-123',
      message: 'Hello',
    });

    const messages = chatStore.getMessages('conv-123');
    expect(messages).toHaveLength(2); // User + Assistant
    expect(messages[1].role).toBe('assistant');
  });
});
```

---

## Checklist for New Features

When implementing a new feature:

- [ ] Use transport types exclusively
- [ ] No modifications to transport types
- [ ] Business logic in services, not store
- [ ] Store has only simple mutations
- [ ] Components call services, not APIs
- [ ] Follow A2A protocol (JSON-RPC 2.0)
- [ ] Include LLM configuration in requests
- [ ] Handle responses using transport types
- [ ] Update store via simple mutations
- [ ] Handle errors gracefully
- [ ] Write unit tests for services
- [ ] Write integration tests for flows
- [ ] Follow existing patterns

---

## Quick Reference

**DO:**
✅ Use transport types from `@orchestrator-ai/transport-types`
✅ Put business logic in services
✅ Keep store state-only
✅ Call services from components
✅ Follow A2A protocol strictly
✅ Include LLM config in requests
✅ Handle errors gracefully

**DON'T:**
❌ Modify transport types
❌ Put business logic in store
❌ Put business logic in components
❌ Call APIs directly from components
❌ Mutate store directly from components
❌ Use fallback LLM configs
❌ Deviate from A2A protocol

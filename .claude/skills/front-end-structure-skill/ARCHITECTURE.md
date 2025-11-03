# Front-End Architecture - Critical Patterns

## The Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│         VIEW LAYER (Components)         │
│  - Reads from stores                    │
│  - Calls service methods                │
│  - Reacts to store changes automatically│
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│         SERVICE LAYER                   │
│  - Builds requests with transport types  │
│  - Makes API calls                      │
│  - Updates stores with responses        │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│         STORE LAYER (Pinia)             │
│  - Holds state ONLY (ref/computed)      │
│  - Simple setters                       │
│  - NO methods, NO API calls             │
└─────────────────────────────────────────┘
```

## Critical Rule #1: Stores Are Data-Only

**❌ FORBIDDEN - DO NOT DO THIS:**
```typescript
// ❌ WRONG - Store with methods that do work
export const useMyStore = defineStore('myStore', () => {
  const data = ref(null);
  
  // ❌ FORBIDDEN - Async method in store
  async function fetchData() {
    const response = await fetch('/api/data');
    data.value = await response.json();
  }
  
  // ❌ FORBIDDEN - Business logic in store
  function processData() {
    // Complex processing...
  }
  
  return { data, fetchData, processData };
});
```

**✅ CORRECT - Store with state only:**
```typescript
// ✅ CORRECT - Store holds state only
export const useMyStore = defineStore('myStore', () => {
  // State only
  const data = ref<MyDataType | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  // Computed getters (derived state)
  const hasData = computed(() => data.value !== null);
  
  // Simple setters (synchronous state updates only)
  function setData(newData: MyDataType) {
    data.value = newData;
  }
  
  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }
  
  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }
  
  function reset() {
    data.value = null;
    isLoading.value = false;
    error.value = null;
  }
  
  return { 
    // State
    data, 
    isLoading, 
    error,
    // Getters
    hasData,
    // Setters (synchronous only)
    setData, 
    setLoading, 
    setError, 
    reset 
  };
});
```

## Critical Rule #2: Services Handle API Calls

**✅ CORRECT - Service makes API calls and updates store:**
```typescript
// ✅ CORRECT - Service handles API calls
import { useMyStore } from '@/stores/myStore';
import { buildRequest } from '@/services/agent2agent/utils/builders';
import { agent2AgentApi } from '@/services/agent2agent/api/agent2agent.api';

export const myService = {
  async fetchData(conversationId: string) {
    const store = useMyStore();
    
    // 1. Update loading state
    store.setLoading(true);
    store.setError(null);
    
    try {
      // 2. Build request with transport types
      const request = buildRequest.plan.read({ conversationId });
      
      // 3. Make API call
      const response = await agent2AgentApi.executeStrictRequest(request);
      
      // 4. Update store with response
      store.setData(response.result);
      
      return response.result;
    } catch (error) {
      // 5. Update store with error
      store.setError(error.message);
      throw error;
    } finally {
      // 6. Update loading state
      store.setLoading(false);
    }
  }
};
```

## Critical Rule #3: Build Requests with Transport Types

**Transport types are separate** - They're used when building requests, not in stores.

**✅ CORRECT - Use transport types when building requests:**
```typescript
import { buildRequest } from '@/services/agent2agent/utils/builders';
import type { StrictPlanRequest } from '@orchestrator-ai/transport-types';

// ✅ CORRECT - Build request with transport types
const request: StrictPlanRequest = buildRequest.plan.create(
  { conversationId, userMessage: message },
  { title: '', content: message }
);

// Then make API call
const response = await agent2AgentApi.executeStrictRequest(request);
```

**❌ WRONG - Don't use transport types in stores:**
```typescript
// ❌ WRONG - Transport types don't belong in stores
export const useMyStore = defineStore('myStore', () => {
  const request = ref<StrictPlanRequest | null>(null); // ❌ Don't store requests
  // ...
});
```

## Critical Rule #4: Response → Store → View Reactivity

**The flow is ALWAYS:**
1. Service makes API call
2. Service updates store state
3. Vue reactivity automatically updates UI

**✅ CORRECT - Component uses service, reads from store:**
```vue
<template>
  <div>
    <!-- Vue automatically reacts to store changes -->
    <div v-if="store.isLoading">Loading...</div>
    <div v-if="store.error">{{ store.error }}</div>
    <div v-if="store.data">{{ store.data }}</div>
    
    <button @click="handleClick">Fetch Data</button>
  </div>
</template>

<script setup lang="ts">
import { useMyStore } from '@/stores/myStore';
import { myService } from '@/services/myService';

const store = useMyStore();

// Component calls service method
async function handleClick() {
  await myService.fetchData('conversation-id');
  // Store is updated by service
  // Vue automatically re-renders because store.isLoading, store.data changed
}
</script>
```

**Why this works:**
- Store uses `ref()` - Vue tracks changes
- Component reads from store - Reactive binding
- Service updates store - Triggers reactivity
- No manual `forceUpdate()` or `nextTick()` needed

## Critical Rule #5: NEVER Write Methods on Stores

**Common mistake agents make:**
```typescript
// ❌ WRONG - Method on store breaks reactivity
export const useMyStore = defineStore('myStore', () => {
  const items = ref<Item[]>([]);
  
  // ❌ FORBIDDEN - Method that processes data
  function addItem(item: Item) {
    items.value.push(item); // This works, but...
    this.processItems(); // ❌ Calling other methods breaks patterns
  }
  
  // ❌ FORBIDDEN - Method with logic
  function processItems() {
    items.value = items.value.map(item => {
      // Complex processing...
      return processedItem;
    });
  }
  
  return { items, addItem, processItems };
});
```

**Why this breaks:**
- Breaks the separation of concerns
- Makes stores harder to test
- Can cause reactivity issues
- Agents tend to add more methods, creating a mess

**✅ CORRECT - Keep stores simple:**
```typescript
// ✅ CORRECT - Simple state management
export const useMyStore = defineStore('myStore', () => {
  const items = ref<Item[]>([]);
  
  // Simple setter
  function setItems(newItems: Item[]) {
    items.value = newItems;
  }
  
  // Simple adder
  function addItem(item: Item) {
    items.value = [...items.value, item];
  }
  
  return { items, setItems, addItem };
});

// Processing happens in service or component
export const myService = {
  async fetchAndProcessItems() {
    const rawItems = await fetchItems();
    const processed = rawItems.map(/* process */);
    const store = useMyStore();
    store.setItems(processed);
  }
};
```

## Example: Complete Pattern

### Store (Data Only)
```typescript
// stores/conversationsStore.ts
export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  
  const currentConversation = computed(() => 
    conversations.value.find(c => c.id === currentConversationId.value)
  );
  
  function setConversations(newConversations: Conversation[]) {
    conversations.value = newConversations;
  }
  
  function addConversation(conversation: Conversation) {
    conversations.value = [...conversations.value, conversation];
  }
  
  function setCurrentConversationId(id: string | null) {
    currentConversationId.value = id;
  }
  
  return {
    conversations,
    currentConversationId,
    currentConversation,
    setConversations,
    addConversation,
    setCurrentConversationId,
  };
});
```

### Service (API Calls + Store Updates)
```typescript
// services/conversationsService.ts
import { useConversationsStore } from '@/stores/conversationsStore';
import { buildRequest } from '@/services/agent2agent/utils/builders';
import { agent2AgentApi } from '@/services/agent2agent/api/agent2agent.api';

export const conversationsService = {
  async loadConversations() {
    const store = useConversationsStore();
    
    try {
      const request = buildRequest.plan.list({ conversationId: 'current' });
      const response = await agent2AgentApi.executeStrictRequest(request);
      
      // Update store with response
      store.setConversations(response.result.conversations);
      
      return response.result;
    } catch (error) {
      console.error('Failed to load conversations:', error);
      throw error;
    }
  },
  
  async createConversation(title: string) {
    const store = useConversationsStore();
    
    try {
      const request = buildRequest.plan.create(
        { conversationId: 'new', userMessage: title },
        { title, content: '' }
      );
      const response = await agent2AgentApi.executeStrictRequest(request);
      
      // Update store with new conversation
      store.addConversation(response.result.conversation);
      store.setCurrentConversationId(response.result.conversation.id);
      
      return response.result;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }
};
```

### Component (Uses Service, Reads Store)
```vue
<template>
  <div>
    <div v-if="store.currentConversation">
      <h2>{{ store.currentConversation.title }}</h2>
    </div>
    
    <ul>
      <li 
        v-for="conv in store.conversations" 
        :key="conv.id"
        @click="selectConversation(conv.id)"
      >
        {{ conv.title }}
      </li>
    </ul>
    
    <button @click="createNew">New Conversation</button>
  </div>
</template>

<script setup lang="ts">
import { useConversationsStore } from '@/stores/conversationsStore';
import { conversationsService } from '@/services/conversationsService';
import { onMounted } from 'vue';

const store = useConversationsStore();

onMounted(() => {
  conversationsService.loadConversations();
});

function selectConversation(id: string) {
  store.setCurrentConversationId(id);
  // Vue automatically updates because currentConversation computed changes
}

async function createNew() {
  await conversationsService.createConversation('New Chat');
  // Store updated by service, Vue reacts automatically
}
</script>
```

## Common Mistakes to Avoid

### ❌ Mistake 1: API Calls in Stores
```typescript
// ❌ WRONG
async function fetchData() {
  const response = await api.get('/data');
  this.data = response.data;
}
```

### ❌ Mistake 2: Complex Logic in Stores
```typescript
// ❌ WRONG
function processData() {
  this.data = this.data.map(/* complex logic */);
}
```

### ❌ Mistake 3: Methods Calling Other Methods
```typescript
// ❌ WRONG
function update() {
  this.validate();
  this.process();
  this.save();
}
```

### ❌ Mistake 4: Not Using Transport Types
```typescript
// ❌ WRONG - Raw fetch without transport types
const response = await fetch('/api/plan', {
  method: 'POST',
  body: JSON.stringify({ conversationId })
});
```

### ❌ Mistake 5: Manual UI Updates
```typescript
// ❌ WRONG - Manually updating UI
function updateUI() {
  document.getElementById('data').innerHTML = this.data;
}
```

## Checklist for Front-End Code

When writing front-end code, verify:

- [ ] Store contains ONLY state (ref/computed) and simple setters
- [ ] Store has NO async methods
- [ ] Store has NO API calls
- [ ] Store has NO complex business logic
- [ ] Service handles ALL API calls
- [ ] Service uses transport types when building requests
- [ ] Service updates store after API calls
- [ ] Component calls service methods (not store methods for API)
- [ ] Component reads from store for display
- [ ] Vue reactivity handles UI updates automatically
- [ ] No manual DOM manipulation
- [ ] No `forceUpdate()` or similar hacks

## File Structure

```
apps/web/src/
├── stores/                    # Pinia stores (data only)
│   ├── conversationsStore.ts
│   ├── authStore.ts
│   └── ...
├── services/                  # API calls and business logic
│   ├── agent2agent/
│   │   ├── api/
│   │   │   └── agent2agent.api.ts
│   │   └── utils/
│   │       └── builders/
│   │           └── build.builder.ts (uses transport types)
│   ├── conversationsService.ts
│   └── ...
├── components/                # Vue components
│   ├── ConversationList.vue
│   └── ...
└── types/                     # TypeScript types
    └── ...
```

## Why This Architecture?

1. **Testability** - Stores are simple to test (just state)
2. **Reactivity** - Vue automatically tracks ref/computed changes
3. **Separation of Concerns** - Services = logic, Stores = data, Components = UI
4. **Type Safety** - Transport types ensure correct API calls
5. **Maintainability** - Clear boundaries make code easier to understand
6. **Performance** - Vue reactivity is optimized for this pattern

## Transport Types Reference

Transport types are imported from:
```typescript
import type {
  StrictA2ARequest,
  StrictA2ASuccessResponse,
  StrictA2AErrorResponse,
  AgentTaskMode,
  BuildAction,
  PlanAction,
  // ... etc
} from '@orchestrator-ai/transport-types';
```

Build requests using:
```typescript
import { buildRequest } from '@/services/agent2agent/utils/builders';

const request = buildRequest.plan.create(
  { conversationId, userMessage },
  { title, content }
);
```

This ensures all requests match the A2A protocol exactly.


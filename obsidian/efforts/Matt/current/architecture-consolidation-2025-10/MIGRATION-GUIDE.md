# Migration Guide: Architecture Consolidation

**Audience**: Future developers working on Orchestrator AI
**Purpose**: Guide for working with the consolidated architecture
**Last Updated**: 2025-10-17

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Common Migration Scenarios](#common-migration-scenarios)
3. [Before & After Examples](#before--after-examples)
4. [Troubleshooting](#troubleshooting)
5. [FAQs](#faqs)

---

## Quick Start

### For New Features

When adding a new feature, follow these steps:

1. **Determine the domain** - Which store does this belong to?
   - User/agent messaging → `conversationsStore`
   - Workflows → `orchestratorStore`
   - Tasks → `taskStore`
   - Deliverables → `deliverablesStore`
   - Privacy/PII → `privacyStore`

2. **Define types first** - Add types to `/types/{domain}.ts`
   ```typescript
   // types/myDomain.ts
   export interface MyEntity {
     id: string;
     name: string;
     createdAt: Date;
     metadata?: MyMetadata;
   }

   export interface MyMetadata {
     source?: 'user' | 'system';
     priority?: 'low' | 'high';
   }
   ```

3. **Update store** - Add state and synchronous actions
   ```typescript
   // stores/myDomainStore.ts
   export const useMyDomainStore = defineStore('myDomain', () => {
     const entities = ref<ReadonlyMap<string, MyEntity>>(new Map());

     function addEntity(entity: MyEntity) {
       entities.value = new Map(entities.value).set(entity.id, entity);
     }

     return { entities: readonly(entities), addEntity };
   });
   ```

4. **Create service** - Handle async operations
   ```typescript
   // services/myDomainService.ts
   export class MyDomainService {
     async fetchEntities(): Promise<MyEntity[]> {
       const store = useMyDomainStore();
       const response = await api.get('/entities');
       response.data.forEach(e => store.addEntity(e));
       return response.data;
     }
   }
   ```

5. **Use in component** - Call service, read from store
   ```vue
   <script setup>
   import { onMounted, computed } from 'vue';
   import { useMyDomainStore } from '@/stores/myDomainStore';
   import { myDomainService } from '@/services/myDomainService';

   const store = useMyDomainStore();
   const entities = computed(() => Array.from(store.entities.values()));

   onMounted(() => myDomainService.fetchEntities());
   </script>
   ```

---

## Common Migration Scenarios

### Scenario 1: Moving Async Logic from Store to Service

**Problem**: You have a store with async methods that need to be refactored.

**Old Pattern**:
```typescript
// stores/myStore.ts (OLD - DON'T DO THIS)
export const useMyStore = defineStore('my', () => {
  const data = ref([]);

  async function fetchData() {
    const response = await api.get('/data');
    data.value = response.data;
  }

  return { data, fetchData };
});

// Component usage (OLD)
const store = useMyStore();
await store.fetchData(); // Calling async method on store
```

**New Pattern**:
```typescript
// stores/myStore.ts (NEW - Stores = Data Only)
export const useMyStore = defineStore('my', () => {
  const data = ref([]);

  function setData(newData: any[]) {
    data.value = newData;
  }

  return { data: readonly(data), setData };
});

// services/myService.ts (NEW - Services handle async)
export class MyService {
  async fetchData() {
    const store = useMyStore();
    const response = await api.get('/data');
    store.setData(response.data);
  }
}
export const myService = new MyService();

// Component usage (NEW)
import { myService } from '@/services/myService';
await myService.fetchData(); // Call service, not store
```

**Migration Steps**:
1. Create service file in `/services/`
2. Move async method to service
3. Add synchronous `setData()` method to store
4. Update all component imports to use service
5. Remove async method from store

---

### Scenario 2: Replacing `Record<string, any>` with Typed Metadata

**Problem**: Store uses untyped metadata that needs type safety.

**Old Pattern**:
```typescript
// types/myDomain.ts (OLD)
export interface MyEntity {
  id: string;
  metadata?: Record<string, any>; // ❌ Not type-safe
}

// Component usage (OLD)
entity.metadata.priority; // No autocomplete, no type checking
```

**New Pattern**:
```typescript
// types/myDomain.ts (NEW)
export interface MyEntity {
  id: string;
  metadata?: MyEntityMetadata;
}

export interface MyEntityMetadata {
  priority?: 'low' | 'normal' | 'high';
  tags?: string[];
  source?: 'user' | 'system';
  relatedTo?: {
    projectId?: string;
    userId?: string;
  };
}

// Component usage (NEW)
entity.metadata?.priority; // ✅ Full type safety and autocomplete
```

**Migration Steps**:
1. Create explicit metadata interface in `/types/{domain}.ts`
2. Define all expected fields with types
3. Update entity interface to use new metadata type
4. Re-export types from store for backward compatibility:
   ```typescript
   export type { MyEntity, MyEntityMetadata } from '@/types/myDomain';
   ```
5. Components automatically get type safety (no changes needed)

---

### Scenario 3: Adding State to Existing Store

**Problem**: Need to add new state to an existing store.

**Steps**:

1. **Add type definition**:
   ```typescript
   // types/myDomain.ts
   export interface NewEntity {
     id: string;
     name: string;
     status: 'active' | 'inactive';
   }
   ```

2. **Add state to store**:
   ```typescript
   // stores/myDomainStore.ts
   import type { NewEntity } from '@/types/myDomain';

   export const useMyDomainStore = defineStore('myDomain', () => {
     // Existing state
     const existingData = ref(...);

     // NEW: Add new state
     const newEntities = ref<ReadonlyMap<string, NewEntity>>(new Map());

     // NEW: Add actions
     function addNewEntity(entity: NewEntity) {
       newEntities.value = new Map(newEntities.value).set(entity.id, entity);
     }

     function removeNewEntity(id: string) {
       const updated = new Map(newEntities.value);
       updated.delete(id);
       newEntities.value = updated;
     }

     // NEW: Add getter
     const newEntityList = computed(() =>
       Array.from(newEntities.value.values())
     );

     return {
       // Existing exports
       existingData,

       // NEW: Export new state/actions
       newEntities: readonly(newEntities),
       newEntityList,
       addNewEntity,
       removeNewEntity,
     };
   });
   ```

3. **Add service methods** (if async operations needed):
   ```typescript
   // services/myDomainService.ts
   export class MyDomainService {
     async fetchNewEntities() {
       const store = useMyDomainStore();
       const response = await api.get('/new-entities');
       response.data.forEach(e => store.addNewEntity(e));
     }
   }
   ```

---

### Scenario 4: Coordinating Multiple Stores

**Problem**: A single operation needs to update multiple stores.

**Pattern**: Use a service to coordinate

**Example**:
```typescript
// services/orchestrationService.ts
export class OrchestrationService {
  async startOrchestration(conversationId: string, plan: Plan) {
    const orchestratorStore = useOrchestratorStore();
    const conversationsStore = useConversationsStore();
    const taskStore = useTaskStore();

    try {
      // 1. Create orchestration (API call)
      const orchestration = await api.post('/orchestrations', {
        conversationId,
        plan,
      });

      // 2. Update orchestrator store
      orchestratorStore.addOrchestration(orchestration);

      // 3. Update conversation with orchestration reference
      conversationsStore.updateConversation(conversationId, {
        metadata: {
          orchestrationId: orchestration.id,
          orchestrationStatus: 'running',
        },
      });

      // 4. Create initial tasks
      orchestration.steps.forEach(step => {
        const task = this.createTaskFromStep(step);
        taskStore.addTask(task);
      });

      return orchestration;
    } catch (error) {
      // Centralized error handling
      orchestratorStore.setError('Failed to start orchestration');
      throw error;
    }
  }
}
```

**Benefits**:
- Single source of truth for complex operations
- Atomic updates across stores
- Centralized error handling
- Easy to test

---

## Before & After Examples

### Example 1: Conversation Creation

**Before (Old Architecture)**:
```typescript
// Component (OLD)
<script setup>
import { useConversationsStore } from '@/stores/conversationsStore';

const store = useConversationsStore();

async function createConversation(title: string, agentType: string) {
  // Async logic directly in component
  try {
    const response = await api.post('/conversations', { title, agentType });
    store.addConversation(response.data);
  } catch (error) {
    console.error(error);
  }
}
</script>
```

**After (New Architecture)**:
```typescript
// Service (NEW)
export class ConversationService {
  async createConversation(payload: CreateConversationPayload): Promise<Conversation> {
    const store = useConversationsStore();

    try {
      store.setLoading(true);
      const response = await api.post('/conversations', payload);
      store.addConversation(response.data);
      return response.data;
    } catch (error) {
      store.setError('Failed to create conversation');
      throw error;
    } finally {
      store.setLoading(false);
    }
  }
}

// Component (NEW)
<script setup>
import { conversationService } from '@/services/conversationService';

async function createConversation(title: string, agentType: string) {
  await conversationService.createConversation({ title, agentType });
}
</script>
```

**Benefits**:
- Component is simpler
- Loading/error states handled by service
- Reusable logic across components

---

### Example 2: Type-Safe Metadata

**Before (Old Architecture)**:
```typescript
// Type definition (OLD)
export interface Task {
  id: string;
  name: string;
  metadata?: Record<string, any>; // ❌ No type safety
}

// Component usage (OLD)
const task: Task = {
  id: '123',
  name: 'My Task',
  metadata: {
    priority: 'hgih', // ❌ Typo not caught
    unknownField: 'value', // ❌ No validation
  },
};

// Reading metadata (OLD)
console.log(task.metadata.priority); // ❌ No autocomplete
```

**After (New Architecture)**:
```typescript
// Type definition (NEW)
export interface Task {
  id: string;
  name: string;
  metadata?: TaskMetadata; // ✅ Type-safe
}

export interface TaskMetadata {
  source?: 'user' | 'orchestration' | 'agent' | 'system';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  estimatedDuration?: number;
  tags?: string[];
  relatedTo?: {
    conversationId?: string;
    orchestrationId?: string;
    deliverableId?: string;
  };
}

// Component usage (NEW)
const task: Task = {
  id: '123',
  name: 'My Task',
  metadata: {
    priority: 'hgih', // ✅ TypeScript error: "hgih" is not assignable to type
    unknownField: 'value', // ✅ TypeScript error: unknown property
  },
};

// Reading metadata (NEW)
console.log(task.metadata?.priority); // ✅ Full autocomplete
```

**Benefits**:
- Catch typos at compile time
- IDE autocomplete for all fields
- Self-documenting code

---

### Example 3: Immutable State Updates

**Before (Old Architecture)**:
```typescript
// Store (OLD)
export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Map<string, Conversation>>(new Map());

  function updateConversation(id: string, updates: Partial<Conversation>) {
    const conv = conversations.value.get(id);
    if (!conv) return;

    Object.assign(conv, updates); // ❌ Mutation - Vue might miss update
  }

  return { conversations, updateConversation };
});
```

**After (New Architecture)**:
```typescript
// Store (NEW)
export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<ReadonlyMap<string, Conversation>>(new Map());

  function updateConversation(id: string, updates: Partial<Conversation>) {
    const conv = conversations.value.get(id);
    if (!conv) return;

    // ✅ Create new objects - Vue detects change
    const updated = { ...conv, ...updates, updatedAt: new Date() };
    conversations.value = new Map(conversations.value).set(id, updated);
  }

  return { conversations: readonly(conversations), updateConversation };
});
```

**Benefits**:
- Vue 3 reactivity always works
- Time-travel debugging possible
- Prevents accidental mutations

---

## Troubleshooting

### Issue 1: "Property does not exist on type 'Store'"

**Symptom**:
```typescript
const store = useMyStore();
store.someMethod(); // ❌ TypeScript error
```

**Cause**: Method not exported from store's return statement

**Fix**:
```typescript
export const useMyStore = defineStore('my', () => {
  function someMethod() {
    // ...
  }

  return {
    someMethod, // ✅ Must export in return
  };
});
```

---

### Issue 2: "Cannot assign to 'readonly' property"

**Symptom**:
```typescript
const store = useMyStore();
store.data.value = newData; // ❌ Error: readonly
```

**Cause**: Store state is wrapped with `readonly()`

**Fix**: Use store actions instead
```typescript
// Store
export const useMyStore = defineStore('my', () => {
  const data = ref([]);

  function setData(newData: any[]) {
    data.value = newData; // ✅ Update via action
  }

  return {
    data: readonly(data), // Readonly for external access
    setData, // Action to update
  };
});

// Component
const store = useMyStore();
store.setData(newData); // ✅ Use action
```

---

### Issue 3: "Type 'any' is not assignable"

**Symptom**:
```typescript
function myFunction(data: MyType) {
  // Type error when passing to API
  await api.post('/endpoint', data);
}
```

**Cause**: Need explicit type for API payload

**Fix**: Define payload type
```typescript
// types/myDomain.ts
export type CreateMyTypePayload = Omit<MyType, 'id' | 'createdAt'>;

// Service
function myFunction(data: CreateMyTypePayload) {
  await api.post('/endpoint', data); // ✅ Type-safe
}
```

---

### Issue 4: Store state not updating in component

**Symptom**: Component doesn't re-render when store changes

**Possible Causes**:

1. **Not using computed/reactive**
   ```typescript
   // ❌ BAD: Direct access loses reactivity
   const data = store.data;

   // ✅ GOOD: Use computed
   const data = computed(() => store.data);
   ```

2. **Mutating instead of replacing**
   ```typescript
   // ❌ BAD: Mutation not detected
   function update(id: string) {
     const item = items.value.get(id);
     item.name = 'new name'; // Mutation
   }

   // ✅ GOOD: Create new reference
   function update(id: string) {
     const item = items.value.get(id);
     const updated = { ...item, name: 'new name' };
     items.value = new Map(items.value).set(id, updated);
   }
   ```

---

## FAQs

### Q: Can I still put async methods in stores?

**A**: No. The new architecture pattern is "Stores = Data Only". All async operations should be in services. This ensures:
- Predictable state updates
- Easier testing (no mocking async calls in stores)
- Clear separation of concerns

**Exception**: If you have a very simple async operation that only updates one store and has no error handling, you might be tempted. Still, use a service for consistency.

---

### Q: Do I need to create a service for every store?

**A**: Not always. If your store only handles UI state (like sidebar visibility, modal state), you may not need a service. Services are for:
- API calls
- Complex business logic
- Multi-store coordination

---

### Q: Can I use `Record<string, any>` for truly dynamic data?

**A**: Use `Record<string, unknown>` instead:
```typescript
// ❌ BAD
metadata: Record<string, any>;

// ✅ BETTER: Unknown forces type checking
metadata: Record<string, unknown>;

// ✅ BEST: Define explicit structure when possible
metadata: MyMetadata;
```

---

### Q: How do I handle optional fields in types?

**A**: Use the `?` operator:
```typescript
export interface MyEntity {
  id: string;          // Required
  name: string;        // Required
  description?: string; // Optional
  metadata?: MyMetadata; // Optional
}
```

---

### Q: Should I use `ref()` or `reactive()` in stores?

**A**: Prefer `ref()` for consistency:
- Works with primitives and objects
- `.value` makes updates explicit
- Easier to make readonly: `readonly(myRef)`

```typescript
// ✅ GOOD: Use ref
const data = ref<Map<string, Item>>(new Map());

// ❌ AVOID: reactive() for complex objects
const data = reactive({ items: new Map() });
```

---

### Q: How do I add a new domain store?

**A**: Follow these steps:

1. Create `/types/{domain}.ts` with all type definitions
2. Create `/stores/{domain}Store.ts` following the pattern:
   ```typescript
   export const useMyDomainStore = defineStore('myDomain', () => {
     // State
     const entities = ref<ReadonlyMap<string, MyEntity>>(new Map());

     // Getters
     const entityList = computed(() => Array.from(entities.value.values()));

     // Actions
     function addEntity(entity: MyEntity) {
       entities.value = new Map(entities.value).set(entity.id, entity);
     }

     // Return
     return {
       entities: readonly(entities),
       entityList,
       addEntity,
     };
   });
   ```
3. Create `/services/{domain}Service.ts` if async operations needed
4. Export types from store for backward compatibility

---

### Q: What's the difference between `readonly()` and `Readonly<T>`?

**A**:
- `readonly()` - Vue composable that makes a ref readonly (runtime)
- `Readonly<T>` - TypeScript type utility (compile-time only)

```typescript
// Vue runtime readonly (use for refs)
const data = ref([1, 2, 3]);
return { data: readonly(data) };

// TypeScript readonly (use for types)
type MyReadonlyType = Readonly<MyType>;
```

---

### Q: How do I test stores now?

**A**: Stores are easier to test since they're synchronous:

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useMyStore } from '@/stores/myStore';

describe('MyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should add entity', () => {
    const store = useMyStore();
    const entity = { id: '1', name: 'Test' };

    store.addEntity(entity);

    expect(store.entityList).toContainEqual(entity);
  });
});
```

---

## Summary

The consolidated architecture provides:

✅ **Type Safety** - Explicit types throughout
✅ **Separation of Concerns** - Stores = Data, Services = Logic
✅ **Predictability** - Immutable updates, synchronous stores
✅ **Maintainability** - Clear patterns, easy to understand
✅ **Testability** - No async in stores, simple to test

Follow the patterns in this guide to maintain consistency and quality across the codebase.

---

**Need Help?**
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architectural patterns
- Check [PRD.md](./PRD.md) for original requirements
- See [PLAN.md](./PLAN.md) for phase-by-phase breakdown

**Last Updated**: 2025-10-17

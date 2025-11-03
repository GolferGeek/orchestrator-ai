---
description: "Create a new Pinia store following Orchestrator AI architecture (state only, no business logic)"
argument-hint: "[store-name] [description]"
---

# Create Frontend Store

Create a new Pinia store following Orchestrator AI's strict architecture: stores hold state only, no methods, no API calls, no business logic.

**Usage:** `/frontend:store [store-name] [description]`

**Examples:**
- `/frontend:store user "Store for user state and profile data"`
- `/frontend:store` (interactive creation with agent)

## Process

### 1. Invoke Front-End Coding Agent

Invoke `@front-end-coding-agent` to guide the creation process:

```
@front-end-coding-agent

Create Store Request:
- Store Name: [store-name]
- Description: [description]
- State Needed: [what state to store]

Create Pinia store following data-only architecture.
```

**The agent will:**
- Ask for store details (name, what state to store)
- Create store file with proper structure
- Ensure store follows data-only pattern (no business logic)

### 2. Provide Store Information

When prompted by the agent, provide:

**Store Details:**
- Store name (camelCase, e.g., `user`)
- Description (what state this store manages)
- State fields needed (what data to store)
- Computed properties needed (derived state)

**State Structure:**
- What data needs to be stored?
- What loading/error states are needed?
- What filters/sort options are needed?
- What computed properties are needed?

### 3. Agent Creates Store File

The agent will create:
- `apps/web/src/stores/{storeName}Store.ts`

**Store structure:**
```typescript
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const use{StoreName}Store = defineStore('{storeName}', () => {
  // State (ref)
  const data = ref<DataType | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed (getters)
  const getData = computed(() => data.value);
  const isLoading = computed(() => loading.value);

  // Setters (simple, synchronous)
  function setData(newData: DataType | null) {
    data.value = newData;
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }

  return {
    data,
    loading,
    error,
    getData,
    isLoading,
    setData,
    setLoading,
  };
});
```

### 4. Architecture Validation

**The agent ensures:**
- Store contains ONLY state (ref/computed)
- Store contains ONLY simple setters (synchronous)
- Store contains NO async methods
- Store contains NO API calls
- Store contains NO business logic

### 5. Output Summary

```
✅ Frontend Store Created Successfully

📦 Store: userStore.ts
📄 Location: apps/web/src/stores/userStore.ts

📋 Store Structure:
   ✅ State: user, loading, error
   ✅ Computed: getUser, isLoading, getError
   ✅ Setters: setUser, setLoading, setError

📋 Architecture Compliance:
   ✅ State only (ref/computed)
   ✅ Simple setters (synchronous)
   ✅ No async methods
   ✅ No API calls
   ✅ No business logic

📤 Next Steps:
   1. Create service to update store: /frontend:service
   2. Use store in components: /frontend:component
   3. Run quality gates: /quality:all
```

## Important Notes

- **CRITICAL**: Stores hold state ONLY - no methods, no API calls, no business logic
- Stores use `ref()` for state and `computed()` for getters
- Setters are simple, synchronous functions
- Services update stores (stores don't update themselves)
- Vue reactivity handles UI updates automatically

## Store Pattern

**✅ CORRECT:**
- State with `ref()`
- Computed getters with `computed()`
- Simple setters (synchronous)

**❌ WRONG:**
- Async methods
- API calls
- Business logic
- Complex processing

## Related Commands

- `/frontend:service` - Create service to update store
- `/frontend:component` - Create component that uses store
- `/quality:all` - Run quality gates before committing

## Agent Reference

- `@front-end-coding-agent` - Specialized agent for frontend store creation

## Skill Reference

This command leverages the `front-end-structure-skill` for context. See `.claude/skills/front-end-structure-skill/SKILL.md` for detailed store patterns and examples.


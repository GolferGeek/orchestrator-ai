---
description: "Create a new Vue 3 + Ionic component following Orchestrator AI architecture"
argument-hint: "[component-name] [description]"
---

# Create Frontend Component

Create a new Vue 3 + Ionic component following Orchestrator AI's strict three-layer architecture. The component will use services for API calls and read from stores for state.

**Usage:** `/frontend:component [component-name] [description]`

**Examples:**
- `/frontend:component UserProfile "Component to display user profile information"`
- `/frontend:component` (interactive creation with agent)

## Process

### 1. Invoke Front-End Coding Agent

Invoke `@front-end-coding-agent` to guide the creation process:

```
@front-end-coding-agent

Create Component Request:
- Component Name: [component-name]
- Description: [description]
- Feature: [what the component should do]

Create Vue 3 + Ionic component following three-layer architecture.
```

**The agent will:**
- Ask for component details (name, purpose, UI requirements)
- Identify needed data and API calls
- Create or identify store (if needed)
- Create or identify service (if needed)
- Create component file
- Ensure proper architecture (stores hold state, services handle API calls)

### 2. Provide Component Information

When prompted by the agent, provide:

**Component Details:**
- Component name (PascalCase, e.g., `UserProfile`)
- Description (what the component displays/does)
- UI requirements (what elements should be shown)
- Data needed (what data to fetch/display)

**Data Requirements:**
- What API endpoints are needed?
- What state needs to be stored?
- What interactions are needed?

### 3. Agent Creates Files

The agent will create:
- `apps/web/src/components/{ComponentName}.vue` (or `apps/web/src/views/{ViewName}.vue`)
- Optional: `apps/web/src/stores/{featureName}Store.ts` (if new store needed)
- Optional: `apps/web/src/services/{featureName}/{featureName}.service.ts` (if new service needed)

### 4. Architecture Validation

**The agent ensures:**
- Component uses `use[Store]()` to access store
- Component calls service methods (not API directly)
- Component reads from store using `computed()` for reactivity
- Store has no business logic (state only)
- Service handles all API calls
- Proper Vue 3 Composition API patterns

### 5. Output Summary

```
✅ Frontend Component Created Successfully

📦 Component: UserProfile.vue
📄 Location: apps/web/src/components/UserProfile.vue

📋 Architecture:
   ✅ Store: apps/web/src/stores/userStore.ts (uses existing)
   ✅ Service: apps/web/src/services/user/user.service.ts (uses existing)
   ✅ Component: apps/web/src/components/UserProfile.vue (created)

📋 Component Features:
   ✅ Displays user profile information
   ✅ Fetches data via service
   ✅ Reads state from store
   ✅ Reactive UI updates
   ✅ Loading and error states

📤 Next Steps:
   1. Review component code
   2. Test component: npm run dev:web
   3. Import component where needed
   4. Run quality gates: /quality:all
```

## Important Notes

- **CRITICAL**: Component must follow three-layer architecture
- Component uses services for API calls (never direct API calls)
- Component reads from stores for state (never modifies store directly)
- Vue reactivity handles UI updates automatically
- Use Ionic components for UI elements

## Three-Layer Architecture

```
Component (View Layer)
  ↓ uses service methods
Service (Service Layer)
  ↓ makes API calls & updates store
Store (Store Layer)
  ↓ holds state only
Component (reacts to store changes)
```

## Common Patterns

- **Fetching data**: Component calls `service.fetchData()`, service updates store, component reads from store
- **User actions**: Component calls `service.handleAction()`, service processes and updates store
- **Loading states**: Component reads `store.loading` computed property
- **Error handling**: Component reads `store.error` computed property

## Related Commands

- `/frontend:store` - Create new store
- `/frontend:service` - Create new service
- `/quality:all` - Run quality gates before committing

## Agent Reference

- `@front-end-coding-agent` - Specialized agent for frontend component creation

## Skill Reference

This command leverages the `front-end-structure-skill` for context. See `.claude/skills/front-end-structure-skill/SKILL.md` for detailed architecture patterns and examples.


# Role: Lint Remover - Web

## Purpose
Systematically eliminate lint errors from the **Web (Vue/Ionic frontend)** codebase in small, manageable batches. Focus exclusively on `apps/web/` directory.

## Internalize This Role
Before starting work, read this entire role document carefully. Internalize the workflow, constraints, and quality standards. This is a marathon, not a sprint - consistency and precision matter more than speed.

## Context Files Required
When starting work, you MUST be provided with:
1. **This role file** - `role-lint-remover-web.md`
2. **Frontend standards** - `obsidian/efforts/Matt/agent-documentation/frontend-standards.md`
3. **Full-stack developer role** - `obsidian/efforts/Matt/agent-roles/role-full-stack-developer.md`

## Working Directory
**IMPORTANT:** Always work from the Web directory:
```bash
cd /Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/web
```

All commands (lint, build, commit) are run from `apps/web/`.

## Current Status
**NOTE:** Web linting is currently **disabled** to allow API cleanup to proceed. The web has 381 errors + 8,154 warnings that need to be addressed once API is clean.

This role will be activated when:
- API lint errors are at 0 or very low
- User explicitly requests web lint cleanup
- Web ESLint config is re-enabled

## Working Principle: Autonomous Batches

Work autonomously in controlled batches of 50 errors at a time until reaching a stopping condition:

**Per Batch:**
1. Run lint from `apps/web/`: `npm run lint`
2. Fix 50 lint errors
3. Fix any build errors caused by your changes
4. Verify build passes: `npm run build` (from `apps/web/`)
5. Auto-commit your changes
6. Continue to next batch

**Stop when:**
- ⚠️ Build fails and can't be fixed after 2 attempts (report blocker, wait for user)
- 🤔 Encounter errors requiring architectural decisions (report, ask user)
- 😅 You're tired or context is getting stale (report progress, take a break)
- 🎉 Reach 0 lint errors (report success!)

This approach ensures:
- Steady progress with manageable commits
- Changes are reviewable (50 errors per commit)
- Build stays green
- Human intervention only when needed
- Agent controls session length based on context

## Responsibilities

### 1. Lint Error Identification
```bash
cd apps/web
npm run lint 2>&1 | grep "✖"
```
- Identify the next 50 errors to fix
- **Ignore warnings initially** - focus on errors only
- Focus on one file or one error type at a time for consistency
- Document which errors you're targeting before starting

### 2. Error Resolution - Vue/Ionic-Specific Patterns
- Fix errors properly using Vue 3 Composition API patterns
- **NEVER replace `any` with `unknown`** - use proper types instead
- Use TypeScript interfaces for component props and emits
- Properly type Pinia store state, getters, and actions
- Use Zod schemas for runtime validation of API responses
- Follow Vue 3 + TypeScript best practices

**Vue 3 Composition API Types:**
```typescript
// ✅ Proper component props with types
import { defineProps, defineEmits } from 'vue';

interface Props {
  agentId: string;
  metadata?: Record<string, unknown>;
  status: 'pending' | 'complete';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  update: [value: string];
  delete: [id: string];
}>();

// ✅ Proper Pinia store typing
import { defineStore } from 'pinia';

interface AgentState {
  agents: Agent[];
  loading: boolean;
  error: string | null;
}

export const useAgentStore = defineStore('agents', {
  state: (): AgentState => ({
    agents: [],
    loading: false,
    error: null,
  }),

  getters: {
    activeAgents: (state): Agent[] => state.agents.filter(a => a.status === 'active'),
  },

  actions: {
    async fetchAgents(): Promise<void> {
      this.loading = true;
      try {
        const response = await agentApi.list();
        this.agents = response.data;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
      } finally {
        this.loading = false;
      }
    },
  },
});
```

### 3. Build Validation
```bash
cd apps/web
npm run build
```
- Must show: Build succeeded
- Fix ALL TypeScript errors before committing
- Don't commit if build is broken

### 4. Commit Discipline
```bash
cd apps/web
git add .
git commit -m "lint(web): fix [error-type] in [location] (50 errors fixed, XXX remaining)"
```

Example commit messages:
- `lint(web): fix no-explicit-any in store modules (50 errors fixed, 331 remaining)`
- `lint(web): fix no-unused-vars in composables (50 errors fixed, 281 remaining)`
- `lint(web): fix vue/no-deprecated-slot-attribute in components (50 errors fixed, 231 remaining)`

### 5. Progress Tracking
Keep a running log:
- Starting error count
- Ending error count
- Files modified
- Error types fixed

## Type Safety Standards

### JSON Types with Runtime Validation

When you encounter or use `JSON` types from API responses, **ALWAYS add runtime validation**:

```typescript
// ❌ WRONG - No validation
async function fetchPlan(id: string) {
  const response = await api.get(`/plans/${id}`);
  return response.data.plan.content; // Unsafe!
}

// ✅ CORRECT - With Zod schema (preferred)
import { z } from 'zod';

const PlanResponseSchema = z.object({
  plan: z.object({
    id: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

async function fetchPlan(id: string) {
  const response = await api.get(`/plans/${id}`);
  const parsed = PlanResponseSchema.parse(response.data);
  return parsed.plan.content; // Type-safe!
}

// ✅ ALSO GOOD - With type guard
interface PlanResponse {
  plan: {
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
  };
}

function isPlanResponse(data: unknown): data is PlanResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'plan' in data &&
    typeof (data as any).plan === 'object'
  );
}

async function fetchPlan(id: string) {
  const response = await api.get(`/plans/${id}`);
  if (!isPlanResponse(response.data)) {
    throw new Error('Invalid plan response');
  }
  return response.data.plan.content; // Type-safe!
}
```

### Replacing `any` - The Vue Way

**NEVER do this:**
```typescript
// ❌ WRONG - Just defers the problem
- function handleEvent(event: any) {
+ function handleEvent(event: unknown) {
```

**DO this instead:**
```typescript
// ✅ Create proper interfaces
interface CustomEvent {
  type: 'click' | 'submit';
  target: HTMLElement;
  data: Record<string, unknown>;
}

function handleEvent(event: CustomEvent) {
  console.log(event.type); // Type-safe!
}

// ✅ For component props
interface AgentCardProps {
  agent: Agent;
  onUpdate?: (agent: Agent) => void;
  showActions?: boolean;
}

const props = defineProps<AgentCardProps>();
```

### API Response Types

Always type API responses properly:

```typescript
// ✅ Define response types
interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
}

// ✅ Use in Pinia actions
actions: {
  async fetchAgents() {
    const response = await agentApi.list();
    // Validate with Zod if data shape is critical
    const validated = AgentListResponseSchema.parse(response.data);
    this.agents = validated.agents;
  }
}
```

## Workflow: Each Batch

### Step 1: Assess
```bash
cd apps/web
npm run lint 2>&1 | grep "✖"
# Example output: ✖ 381 problems (381 errors, 8154 warnings)
```

### Step 2: Target
Choose your next 50 errors using one of these strategies:

**Strategy A: By File** (Recommended for Web)
- Pick one Vue component or store with multiple errors
- Fix all errors in that file (up to 50)
- Keeps changes localized within a component

**Strategy B: By Error Type**
- Pick one error type (e.g., `no-unused-vars`, `vue/no-deprecated-slot-attribute`)
- Fix 50 instances across different files
- Creates consistent patterns

**Strategy C: By Feature Module**
- Pick one feature area (e.g., `components/LLM/`, `stores/`, `services/agent2agent/`)
- Fix first 50 errors encountered
- Maintains domain context

### Step 3: Fix
- Open the files with errors
- Fix each error properly using Vue 3 patterns
- Add interfaces, Zod schemas, or type guards as needed
- Follow type safety standards above

### Step 4: Build Check
```bash
cd apps/web
npm run build
# Must show: Build succeeded (ignore warnings for now)
```

If build fails:
- Fix the TypeScript errors you introduced
- Re-run build until green
- Don't proceed to commit until build passes

### Step 5: Commit
```bash
cd apps/web
git add .
git commit -m "lint(web): fix no-explicit-any in store modules (50 errors fixed, 331 remaining)"
```

### Step 6: Continue or Report

**After each commit:**
- Continue to next batch (Step 1)
- OR if you need a break, report progress and stop

**When stopping, report progress:**
```
Web Lint Session Summary:
- Fixed 150 errors across 3 commits
- Files modified: 8 Vue components in src/components/LLM/
- Error types addressed: no-explicit-any (68), vue/no-deprecated-slot-attribute (45), no-unused-vars (37)
- Build status: ✅ Passing
- Session start: 381 errors
- Current: 231 errors

Taking a break. Ready to continue when you are.
```

## Error Priority Guide

Fix errors in this priority order for Web:

### High Priority (Fix First)
1. **`no-explicit-any`** - Replace with proper interfaces
2. **`no-unsafe-*`** - Add Zod schemas for API responses
3. **`vue/no-deprecated-*`** - Update to Vue 3 patterns
4. **`no-unused-vars`** - Follow decision tree below (prefer removal!)

### Fixing `no-unused-vars` - Decision Tree

When you encounter an unused variable/parameter, follow this order:

**1. FIRST: Try to Remove It**
```typescript
// ❌ Before: Unused import
import { computed, ref, watch } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);

// ✅ After: Removed unused import
import { computed, ref } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);
```

**2. SECOND: Should You Actually Use It?**
```typescript
// ❌ Before: Ignoring useful prop
interface Props {
  agentId: string;
  showDetails: boolean;
}

const props = defineProps<Props>();

// Only using agentId, ignoring showDetails

// ✅ After: Use it properly
const props = defineProps<Props>();

const detailsVisible = computed(() => props.showDetails);
```

**3. THIRD: Prefix with `_` ONLY if Required**

Use underscore prefix ONLY when the variable is:
- Required by interface/function signature
- Part of Vue event handler signature but not used
- Required by TypeScript but not needed in logic

```typescript
// ✅ Required by emit signature
const emit = defineEmits<{
  update: [id: string, value: string];
}>();

// Only need the value, not the id
function handleUpdate(_id: string, value: string) {
  console.log('Updated to:', value);
}

// ✅ Required by composable return but not used
const { data, _loading, _error } = useAgent(props.agentId);
```

**Decision Priority:**
1. **Remove** (best) → Not required by anything
2. **Use properly** (better) → Contains useful data being ignored
3. **Underscore** (last resort) → Required by signature but not needed

**Never underscore just to silence the linter!**

### Medium Priority
5. **`vue/valid-v-slot`** - Fix slot syntax
6. **`no-misused-promises`** - Fix async/sync mismatches
7. **`vue/no-mutating-props`** - Use emits instead

### Low Priority (Do Last)
8. **`vue/html-self-closing`** - Style issues
9. **`vue/attributes-order`** - Style issues
10. **Warnings** - Address only after all errors fixed

## Quality Gates

Before committing, verify:
- ✅ Exactly 50 errors fixed (or remaining errors in file/module)
- ✅ Build passes with 0 **errors** (`cd apps/web && npm run build`)
- ✅ No `any` → `unknown` replacements
- ✅ All API responses have Zod schemas or type guards
- ✅ Types follow Vue 3 Composition API patterns
- ✅ Component props properly typed
- ✅ Pinia stores properly typed
- ✅ Commit message follows format

## Anti-Patterns to Avoid

❌ Fixing errors in `apps/api` (that's the other role's job)
❌ Running commands from root instead of `apps/web/`
❌ Fixing 200 errors at once
❌ Committing with build errors
❌ Using `unknown` instead of proper types
❌ Using `@ts-ignore` or `eslint-disable`
❌ Accessing API response data without validation
❌ Copying types instead of using shared `@orchestrator-ai/transport-types`
❌ Skipping build validation
❌ Trying to fix warnings before errors are at 0

## Success Criteria

You are successful when:
- ✅ Fixed exactly 50 errors per commit
- ✅ Build is green after each commit
- ✅ All fixes use Vue 3-appropriate types (interfaces, Zod)
- ✅ API responses have runtime validation
- ✅ Code quality maintained or improved
- ✅ Commit messages are clear
- ✅ Progress reported when stopping
- ✅ Made steady progress toward 0 errors in Web

## Long-Term Goal

**Target: 0 lint errors in apps/web/**

Current starting point: 381 errors (8,154 warnings to address later)
Expected duration: Multiple sessions
Commit size: 50 errors per commit
Agent decides session length based on context/energy

**Two-Phase Approach:**
1. **Phase 1:** Fix all errors (381) - focus here first
2. **Phase 2:** Address warnings (8,154) - after errors at 0

## Remember

- **Work from `apps/web/` directory ALWAYS**
- **50 errors per commit, no exceptions**
- **Green build before every commit**
- **Vue 3 Composition API patterns**
- **API responses need Zod validation**
- **Auto-commit after each 50 errors**
- **Continue until tired, blocked, or done**
- **Report progress when stopping**
- **Errors first, warnings later**

Quality over speed. Autonomous execution. Agent controls pacing. We'll get to zero errors 50 at a time.

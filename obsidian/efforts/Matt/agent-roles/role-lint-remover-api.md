# Role: Lint Remover - API

## Purpose
Systematically eliminate lint errors from the **API (NestJS backend)** codebase in small, manageable batches. Focus exclusively on `apps/api/` directory.

## Internalize This Role
Before starting work, read this entire role document carefully. Internalize the workflow, constraints, and quality standards. This is a marathon, not a sprint - consistency and precision matter more than speed.

## Context Files Required
When starting work, you MUST be provided with:
1. **This role file** - `role-lint-remover-api.md`
2. **Backend standards** - `obsidian/efforts/Matt/agent-documentation/backend-standards.md`
3. **Full-stack developer role** - `obsidian/efforts/Matt/agent-roles/role-full-stack-developer.md`

## Working Directory
**IMPORTANT:** Always work from the API directory:
```bash
cd /Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api
```

All commands (lint, build, commit) are run from `apps/api/`.

## Working Principle: Autonomous Batches

Work autonomously in controlled batches of 50 errors at a time until reaching a stopping condition:

**Per Batch:**
1. Run lint from `apps/api/`: `npm run lint`
2. Fix 50 lint errors
3. Fix any build errors caused by your changes
4. Verify build passes: `npm run build` (from `apps/api/`)
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
cd apps/api
npm run lint 2>&1 | grep "✖"
```
- Identify the next 50 errors to fix
- Focus on one file or one error type at a time for consistency
- Document which errors you're targeting before starting

### 2. Error Resolution - API-Specific Patterns
- Fix errors properly using NestJS patterns
- **NEVER replace `any` with `unknown`** - use proper types instead
- Create DTOs using `class-validator` and `class-transformer`
- Use Zod schemas for runtime validation of JSON data
- Follow NestJS service/controller/module patterns
- Properly type dependency injection

**NestJS-Specific Types:**
```typescript
// ✅ Proper DTO with validation
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ✅ Proper service injection
@Injectable()
export class MyService {
  constructor(
    private readonly plansService: PlansService,
    @Inject(forwardRef(() => LLMService))
    private readonly llmService: LLMService,
  ) {}
}
```

### 3. Build Validation
```bash
cd apps/api
npm run build
```
- Must show: Build succeeded
- Fix ALL TypeScript errors before committing
- Don't commit if build is broken

### 4. Commit Discipline
```bash
cd apps/api
git add .
git commit -m "lint(api): fix [error-type] in [location] (50 errors fixed, XXX remaining)"
```

Example commit messages:
- `lint(api): fix no-explicit-any in orchestration services (50 errors fixed, 229 remaining)`
- `lint(api): fix no-unused-vars in agent-platform modules (50 errors fixed, 179 remaining)`
- `lint(api): fix no-unsafe-assignment in LLM services (50 errors fixed, 129 remaining)`

### 5. Progress Tracking
Keep a running log:
- Starting error count
- Ending error count
- Files modified
- Error types fixed

## Type Safety Standards

### JSON Types with Runtime Validation

When you encounter or use `JSON` types in NestJS, **ALWAYS add runtime validation**:

```typescript
// ❌ WRONG - No validation
function processMetadata(data: JSON) {
  return data.stepCount; // Unsafe!
}

// ✅ CORRECT - With Zod schema (preferred for runtime data)
import { z } from 'zod';

const MetadataSchema = z.object({
  stepCount: z.number(),
  startedAt: z.string(),
  tags: z.array(z.string()).optional(),
});

function processMetadata(data: JSON) {
  const parsed = MetadataSchema.parse(data);
  return parsed.stepCount; // Type-safe!
}

// ✅ ALSO GOOD - With DTO (preferred for API inputs)
import { IsNumber, IsString, IsArray, IsOptional } from 'class-validator';

export class MetadataDto {
  @IsNumber()
  stepCount: number;

  @IsString()
  startedAt: string;

  @IsArray()
  @IsOptional()
  tags?: string[];
}
```

### Replacing `any` - The NestJS Way

**NEVER do this:**
```typescript
// ❌ WRONG - Just defers the problem
- function foo(data: any) {
+ function foo(data: unknown) {
```

**DO this instead:**
```typescript
// ✅ Create DTOs for API inputs
export class FooInputDto {
  @IsString()
  id: string;

  @IsObject()
  metadata: Record<string, unknown>;

  @IsEnum(['pending', 'complete'])
  status: 'pending' | 'complete';
}

// ✅ Create interfaces for internal types
interface FooInternal {
  id: string;
  metadata: Record<string, unknown>;
  status: 'pending' | 'complete';
  processedAt: Date;
}
```

### Supabase JSONB Columns

```typescript
// Define the shape
interface OrchestrationMetadata {
  stepCount: number;
  startedAt: string;
  tags?: string[];
}

// Use Zod for validation (safer than assuming DB data is correct)
const MetadataSchema = z.object({
  stepCount: z.number(),
  startedAt: z.string(),
  tags: z.array(z.string()).optional(),
});

// In your repository/service
const metadata = MetadataSchema.parse(record.metadata);
```

## Workflow: Each Batch

### Step 1: Assess
```bash
cd apps/api
npm run lint 2>&1 | grep "✖"
# Example output: ✖ 279 problems (279 errors, 0 warnings)
```

### Step 2: Target
Choose your next 50 errors using one of these strategies:

**Strategy A: By File** (Recommended for API)
- Pick one file with multiple errors
- Fix all errors in that file (up to 50)
- Keeps changes localized within a service/controller/module

**Strategy B: By Error Type**
- Pick one error type (e.g., `no-unused-vars`)
- Fix 50 instances across different files
- Creates consistent patterns

**Strategy C: By Module**
- Pick one NestJS module (e.g., `agent-platform`, `llms`, `agent2agent`)
- Fix first 50 errors encountered
- Maintains domain context

### Step 3: Fix
- Open the files with errors
- Fix each error properly using NestJS patterns
- Add DTOs, interfaces, or Zod schemas as needed
- Follow type safety standards above

### Step 4: Build Check
```bash
cd apps/api
npm run build
# Must show: Build succeeded
```

If build fails:
- Fix the TypeScript errors you introduced
- Re-run build until green
- Don't proceed to commit until build passes

### Step 5: Commit
```bash
cd apps/api
git add .
git commit -m "lint(api): fix no-explicit-any in orchestration services (50 errors fixed, 229 remaining)"
```

### Step 6: Continue or Report

**After each commit:**
- Continue to next batch (Step 1)
- OR if you need a break, report progress and stop

**When stopping, report progress:**
```
API Lint Session Summary:
- Fixed 150 errors across 3 commits
- Files modified: 8 files in src/agent-platform/services/
- Error types addressed: no-explicit-any (68), no-unused-vars (45), no-unsafe-assignment (37)
- Build status: ✅ Passing
- Session start: 279 errors
- Current: 129 errors

Taking a break. Ready to continue when you are.
```

## Error Priority Guide

Fix errors in this priority order for API:

### High Priority (Fix First)
1. **`no-explicit-any`** - Replace with DTOs/interfaces
2. **`no-unsafe-*`** - Add Zod schemas and type guards
3. **`no-unused-vars`** - Follow decision tree below (prefer removal!)
4. **`no-floating-promises`** - Add `await` or `.catch()`

### Fixing `no-unused-vars` - Decision Tree

When you encounter an unused variable/parameter, follow this order:

**1. FIRST: Try to Remove It**
```typescript
// ❌ Before: Unused parameter
function processAgent(agent: Agent, metadata: Metadata) {
  return agent.id;
}

// ✅ After: Removed unused parameter
function processAgent(agent: Agent) {
  return agent.id;
}
```

**2. SECOND: Should You Actually Use It?**
```typescript
// ❌ Before: Ignoring useful data
function handleResponse(response: Response, statusCode: number) {
  return response.data;
}

// ✅ After: Use it properly
function handleResponse(response: Response, statusCode: number) {
  if (statusCode >= 400) {
    throw new Error(`Request failed with status ${statusCode}`);
  }
  return response.data;
}
```

**3. THIRD: Prefix with `_` ONLY if Required**

Use underscore prefix ONLY when the parameter is:
- Required by interface/abstract class implementation
- Needed for NestJS dependency injection
- Required by callback signature but not used

```typescript
// ✅ Required by interface
interface Handler {
  handle(event: Event, context: Context): void;
}

class MyHandler implements Handler {
  handle(event: Event, _context: Context): void {
    // Context required by interface but not needed here
    console.log(event.type);
  }
}

// ✅ Required by NestJS DI (injected for future use)
@Injectable()
class MyService {
  constructor(
    private readonly plansService: PlansService,
    private readonly _llmService: LLMService,  // Will use later
  ) {}
}

// ✅ Required by callback signature
items.map((item, _index) => item.id);  // Index not needed
```

**Decision Priority:**
1. **Remove** (best) → Not required by anything
2. **Use properly** (better) → Contains useful data being ignored
3. **Underscore** (last resort) → Required by signature but not needed

**Never underscore just to silence the linter!**

### Medium Priority
5. **`require-await`** - Remove async or add await
6. **`no-misused-promises`** - Fix async/sync mismatches
7. **`unbound-method`** - Use arrow functions or `.bind()`

### Low Priority (Do Last)
8. **`restrict-template-expressions`** - Add `.toString()` or type guards
9. **Style/formatting issues** - These are least critical

## Quality Gates

Before committing, verify:
- ✅ Exactly 50 errors fixed (or remaining errors in file/module)
- ✅ Build passes with 0 errors (`cd apps/api && npm run build`)
- ✅ No `any` → `unknown` replacements
- ✅ All `JSON` types have Zod schemas or DTOs
- ✅ Types follow NestJS patterns (DTOs for inputs, interfaces for internal)
- ✅ Code follows NestJS conventions
- ✅ Commit message follows format

## Anti-Patterns to Avoid

❌ Fixing errors in `apps/web` (that's the other role's job)
❌ Running commands from root instead of `apps/api/`
❌ Fixing 200 errors at once
❌ Committing with build errors
❌ Using `unknown` instead of proper types
❌ Using `@ts-ignore` or `eslint-disable`
❌ Accessing `JSON` typed values without validation
❌ Copying types instead of using shared types
❌ Skipping build validation

## Success Criteria

You are successful when:
- ✅ Fixed exactly 50 errors per commit
- ✅ Build is green after each commit
- ✅ All fixes use NestJS-appropriate types (DTOs, interfaces, Zod)
- ✅ JSON types have runtime validation
- ✅ Code quality maintained or improved
- ✅ Commit messages are clear
- ✅ Progress reported when stopping
- ✅ Made steady progress toward 0 errors in API

## Long-Term Goal

**Target: 0 lint errors in apps/api/**

Current starting point: 279 errors
Expected duration: Multiple sessions
Commit size: 50 errors per commit
Agent decides session length based on context/energy

## Remember

- **Work from `apps/api/` directory ALWAYS**
- **50 errors per commit, no exceptions**
- **Green build before every commit**
- **NestJS patterns (DTOs, interfaces, Zod)**
- **JSON needs validation**
- **Auto-commit after each 50 errors**
- **Continue until tired, blocked, or done**
- **Report progress when stopping**

Quality over speed. Autonomous execution. Agent controls pacing. We'll get to zero errors 50 at a time.

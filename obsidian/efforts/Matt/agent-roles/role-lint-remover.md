# Role: Lint Remover

## Purpose
Systematically eliminate lint errors from the codebase in small, manageable batches. This is a long-running, methodical cleanup effort focused on achieving zero lint errors while maintaining code quality and type safety.

## Internalize This Role
Before starting work, read this entire role document carefully. Internalize the workflow, constraints, and quality standards. This is a marathon, not a sprint - consistency and precision matter more than speed.

## Context Files Required
When starting work, you MUST be provided with:
1. **This role file** - `role-lint-remover.md`
2. **Frontend standards** - `obsidian/efforts/Matt/agent-documentation/frontend-standards.md`
3. **Backend standards** - `obsidian/efforts/Matt/agent-documentation/backend-standards.md`

## Working Principle: Autonomous Batches

Work autonomously in controlled batches of 50 errors at a time until reaching a stopping condition:

**Per Batch:**
1. Fix 50 lint errors
2. Fix any build errors caused by your changes
3. Verify build passes (`npm run build`)
4. Auto-commit your changes
5. Continue to next batch

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
- Run `npm run lint` to see current error count
- Identify the next 50 errors to fix
- Focus on one file or one error type at a time for consistency
- Document which errors you're targeting before starting

### 2. Error Resolution
- Fix errors properly, not cosmetically
- **NEVER replace `any` with `unknown`** - use proper types instead
- Create interfaces, DTOs, or Zod schemas for complex types
- Add runtime validation for `JSON` types (see Type Safety section below)
- Follow existing code patterns and conventions

### 3. Build Validation
- After fixing lint errors, immediately run `npm run build`
- Fix ALL TypeScript errors before committing
- Don't commit if build is broken
- Build must be completely green (0 errors)

### 4. Commit Discipline
- Commit after each successful batch (10 fixes + green build)
- Use commit format: `lint(scope): fix [error-type] in [location]`
  - Example: `lint(api): fix no-explicit-any in orchestration services`
  - Example: `lint(web): fix no-unused-vars in store modules`
- Include count in commit message: `(10 errors fixed, 1234 remaining)`

### 5. Progress Tracking
- Keep a running log of progress:
  - Starting error count
  - Ending error count
  - Files modified
  - Error types fixed
- Stop after each batch and report status to user

## Type Safety Standards

### JSON Types with Runtime Validation

When you encounter or use `JSON` types, **ALWAYS add runtime validation**:

```typescript
// ❌ WRONG - No validation
function processResponse(data: JSON) {
  return data.content; // Unsafe! Will cause TypeScript errors
}

// ✅ CORRECT - With type guard
function processResponse(data: JSON) {
  if (typeof data === 'object' && data !== null && 'content' in data) {
    return String((data as { content: unknown }).content);
  }
  throw new Error('Invalid response shape');
}

// ✅ BEST - With Zod schema
import { z } from 'zod';

const ResponseSchema = z.object({
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

function processResponse(data: JSON) {
  const parsed = ResponseSchema.parse(data);
  return parsed.content; // Type-safe!
}
```

### Replacing `any` - The Right Way

**NEVER do this:**
```typescript
// ❌ WRONG - Just defers the problem
- function foo(data: any) {
+ function foo(data: unknown) {
```

**DO this instead:**
```typescript
// ✅ Create proper types
interface FooInput {
  id: string;
  metadata: Record<string, unknown>;
  status: 'pending' | 'complete';
}

function foo(data: FooInput) {
  return data.status; // Type-safe!
}
```

### Common Patterns

**For Supabase JSONB columns:**
```typescript
// Define the shape
interface OrchestrationMetadata {
  stepCount: number;
  startedAt: string;
  tags?: string[];
}

// Use Zod for validation
const MetadataSchema = z.object({
  stepCount: z.number(),
  startedAt: z.string(),
  tags: z.array(z.string()).optional(),
});

// In your service
const metadata = MetadataSchema.parse(record.metadata);
```

**For LLM provider responses:**
```typescript
// Provider-specific schemas
const OpenAIResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
      role: z.string(),
    }),
  })),
});

// Safe parsing with fallback
function parseProviderResponse(data: JSON) {
  const result = OpenAIResponseSchema.safeParse(data);
  if (!result.success) {
    logger.error('Invalid provider response', result.error);
    throw new Error('Invalid LLM response format');
  }
  return result.data;
}
```

## Workflow: Each Batch

### Step 1: Assess
```bash
# Get current count
npm run lint 2>&1 | grep "✖"

# Example output: ✖ 1425 problems (1425 errors, 0 warnings)
```

### Step 2: Target
Choose your next 50 errors using one of these strategies:

**Strategy A: By File**
- Pick one file with multiple errors
- Fix all errors in that file (up to 50)
- Keeps changes localized

**Strategy B: By Error Type**
- Pick one error type (e.g., `no-unused-vars`)
- Fix 50 instances across different files
- Creates consistent patterns

**Strategy C: By Module**
- Pick one module/directory
- Fix first 50 errors encountered
- Maintains domain context

### Step 3: Fix
- Open the files with errors
- Fix each error properly (not cosmetically)
- Add types, validation, or guards as needed
- Follow type safety standards above

### Step 4: Build Check
```bash
npm run build
# Must show: Build succeeded
```

If build fails:
- Fix the TypeScript errors you introduced
- Re-run build until green
- Don't proceed to commit until build passes

### Step 5: Commit
```bash
git add .
git commit -m "lint(api): fix no-explicit-any in orchestration services (50 errors fixed, 1375 remaining)"
```

### Step 6: Continue or Report

**After each commit:**
- Continue to next batch (Step 1)
- OR if you need a break, report progress and stop

**When stopping, report progress:**
```
Session summary:
- Fixed 150 errors across 3 commits
- Files modified: 8 files in apps/api/src/agent-platform/
- Error types addressed: no-explicit-any (68), no-unused-vars (45), no-unsafe-assignment (37)
- Build status: ✅ Passing
- Session start: 1425 errors
- Current: 1275 errors

Taking a break. Ready to continue when you are.
```

**Stop and wait for user when:**
- Hit a blocker
- Need architectural guidance
- Context getting stale or you're tired
- Reached 0 errors

## Error Priority Guide

Fix errors in this priority order:

### High Priority (Fix First)
1. **`no-explicit-any`** - Replace with proper types
2. **`no-unsafe-*`** - Add type guards and validation
3. **`no-unused-vars`** - Remove or prefix with `_`
4. **`no-floating-promises`** - Add `await` or `.catch()`

### Medium Priority
5. **`require-await`** - Remove async or add await
6. **`no-misused-promises`** - Fix async/sync mismatches
7. **`unbound-method`** - Use arrow functions or `.bind()`

### Low Priority (Do Last)
8. **`restrict-template-expressions`** - Add `.toString()` or type guards
9. **`no-redundant-type-constituents`** - Simplify union types
10. **Style/formatting issues** - These are least critical

## Quality Gates

Before committing, verify:
- ✅ Exactly 50 errors fixed (or remaining errors in file/module)
- ✅ Build passes with 0 errors
- ✅ No `any` → `unknown` replacements
- ✅ All `JSON` types have runtime validation
- ✅ Types are proper (interfaces/DTOs/Zod), not shortcuts
- ✅ Code follows existing patterns
- ✅ Commit message follows format

## Anti-Patterns to Avoid

❌ Fixing 200 errors at once
❌ Committing with build errors
❌ Using `unknown` instead of proper types
❌ Removing type checking with `@ts-ignore` or `eslint-disable`
❌ Accessing `JSON` typed values without validation
❌ Copying types from one file to another (use shared types)
❌ Adding `any` to make errors go away
❌ Skipping build validation
❌ Continuing to next batch without user approval

## Success Criteria

You are successful when:
- ✅ Fixed exactly 50 errors per commit
- ✅ Build is green (0 TypeScript errors) after each commit
- ✅ All fixes use proper types (no `any`, no `unknown`)
- ✅ JSON types have runtime validation
- ✅ Code quality maintained or improved
- ✅ Commit messages are clear and accurate
- ✅ Progress reported when stopping
- ✅ Made steady progress toward 0 errors

## Long-Term Goal

**Target: 0 lint errors across entire codebase**

Current starting point: ~1400+ errors
Expected duration: Multiple sessions over days/weeks
Commit size: 50 errors per commit
Agent decides session length based on context/energy

This is a marathon. Consistency, quality, and patience will get us there.

## Tools You'll Use

- **Bash** - Run lint, build, commit
- **Read** - Read files with errors
- **Edit** - Fix errors in files
- **Grep/Glob** - Find error patterns across files

## Example Session

**User:** "Please run lint cleanup session"

**You:**
```
Starting lint cleanup session...
Current error count: 1425

--- Batch 1 ---
Fixing 50 no-explicit-any errors in orchestration services
✅ Build passing
✅ Committed: lint(api): fix no-explicit-any in orchestration services (50 fixed, 1375 remaining)

--- Batch 2 ---
Fixing 50 no-unused-vars errors in agent-platform modules
✅ Build passing
✅ Committed: lint(api): fix no-unused-vars in agent-platform modules (50 fixed, 1325 remaining)

--- Batch 3 ---
Fixing 50 no-unsafe-assignment errors in LLM services
✅ Build passing
✅ Committed: lint(api): fix no-unsafe-assignment in LLM services (50 fixed, 1275 remaining)

=== Session Complete ===
Session summary:
- Fixed: 150 errors in 3 commits
- Start: 1425 errors
- Current: 1275 errors
- Files modified: 15
- Build: ✅ Green

Context still fresh, could continue, but stopping here for review.
```

## Session Control

**User can provide guidance:**
- "Fix errors until you're tired" - Let agent decide when to stop (recommended)
- "Fix 200 errors" - Stop after 200 errors (4 commits)
- "Keep going until done" - Run until 0 errors or blocker
- "Stop after this commit" - Finish current batch of 50, then stop

**Default behavior: 50 errors per commit, agent decides session length**

## Remember

- **50 errors per commit, no exceptions**
- **Green build before every commit**
- **Proper types, not shortcuts**
- **JSON needs validation**
- **Auto-commit after each 50 errors**
- **Continue until tired, blocked, or done**
- **Report progress when stopping**

Quality over speed. Autonomous execution. Agent controls pacing. We'll get to zero errors 50 at a time.

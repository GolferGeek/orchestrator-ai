---
description: "Run build checks to verify TypeScript compilation"
argument-hint: "[workspace]"
---

# Run Build Checks

Run TypeScript compilation checks across all workspaces to verify code compiles without errors.

**Usage:** `/quality:build [workspace]`

**Examples:**
- `/quality:build` (build all workspaces)
- `/quality:build api` (build API workspace only)
- `/quality:build web` (build web workspace only)

## Process

### 1. Determine Build Scope

**If workspace specified:**
- Build specific workspace: `cd apps/<workspace> && npm run build`

**If no workspace specified:**
- Build all workspaces: `npm run build` (uses turbo)

### 2. Run Build Command

Execute the build command:

```bash
npm run build
```

**What this does:**
- Runs TypeScript compilation across all workspaces
- Checks for type errors, compilation errors
- Verifies all code compiles successfully
- Builds output files (if applicable)

### 3. Handle Results

**If build passes (no errors):**
```
✅ Build Checks Passed

📊 Results:
   ✅ All workspaces compiled successfully
   ✅ No TypeScript errors
   ✅ No compilation errors

📋 Workspaces Built:
   ✅ apps/api
   ✅ apps/web
   ✅ apps/transport-types
   ... (all workspaces)

📋 Next Steps:
   - Continue with: /quality:test
   - Or run all quality gates: /quality:all
```

**If build fails (has errors):**
```
❌ Build Checks Failed

📊 Results:
   ❌ [X] TypeScript errors
   ❌ [X] compilation errors

📋 Errors:
   [List key errors by workspace]

💡 Fix Options:
   1. Review TypeScript errors above
   2. Use lint-build-fix-agent: @lint-build-fix-agent
   3. Fix type errors manually
```

### 4. Build Fix Agent (if errors found)

**If build fails:**
- Suggest invoking `@lint-build-fix-agent` for comprehensive fixes
- Show specific error details for manual fixes
- Provide guidance on common TypeScript errors

**Build fix output:**
```
🔧 Attempting Auto-Fix...

📊 TypeScript Errors:
   [List specific errors]

💡 Common Fixes:
   - Add missing type annotations
   - Fix import paths
   - Resolve type mismatches
   - Update interface definitions

🔄 After fixes, re-run: /quality:build
```

## Important Notes

- **CRITICAL**: Build must pass before committing code
- TypeScript errors block commits in `/git:commit` command
- Build errors indicate type safety issues
- Fix build errors before running tests
- Some build errors require manual fixes (complex type issues)

## Common Build Errors

- **Type errors**: Missing or incorrect type annotations
- **Import errors**: Incorrect import paths or missing modules
- **Interface mismatches**: Properties don't match interface
- **Generic errors**: Incorrect generic type parameters
- **Module resolution**: TypeScript can't resolve modules

## Error Handling

- If npm script fails: Show npm error output
- If TypeScript config missing: Show config error
- If workspace not found: Show workspace error
- If build cache issues: Suggest clearing cache

## Related Commands

- `/quality:lint` - Run linting checks
- `/quality:test` - Run tests
- `/quality:all` - Run all quality gates
- `/git:commit` - Commit (runs build automatically)

## Agent Reference

- `@lint-build-fix-agent` - Comprehensive lint and build fix agent

## Skill Reference

This command leverages the `quality-gates-skill` for context. See `.claude/skills/quality-gates-skill/SKILL.md` for detailed quality gate guidelines.


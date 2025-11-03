---
description: "Run linting checks and optionally auto-fix issues"
argument-hint: "[--fix]"
---

# Run Linting Checks

Run ESLint linting checks across the codebase. Optionally auto-fix issues using the lint-build-fix-agent.

**Usage:** `/quality:lint [--fix]`

**Examples:**
- `/quality:lint` (check for lint errors)
- `/quality:lint --fix` (check and auto-fix issues)

## Process

### 1. Run Lint Command

Execute the lint command:

```bash
npm run lint
```

**What this does:**
- Runs ESLint across all workspaces (filtered to nestjs)
- Checks for code quality issues (unused imports, type errors, etc.)
- Reports all linting errors and warnings

### 2. Handle Results

**If lint passes (no errors):**
```
✅ Linting Checks Passed

📊 Results:
   ✅ No linting errors
   ✅ Code quality checks passed

📋 Next Steps:
   - Continue with: /quality:build
   - Or run all quality gates: /quality:all
```

**If lint fails (has errors):**
```
❌ Linting Checks Failed

📊 Results:
   ❌ [X] linting errors found
   ❌ [X] warnings

📋 Errors:
   [List key errors]

💡 Fix Options:
   1. Auto-fix: /quality:lint --fix
   2. Manual fix: Review errors above
   3. Use lint-build-fix-agent: @lint-build-fix-agent
```

### 3. Auto-Fix (if --fix flag provided)

**If `--fix` flag provided:**
- Run: `npm run lint -- --fix`
- Or invoke `@lint-build-fix-agent` for more comprehensive fixes
- Re-run lint to verify fixes
- Show summary of fixes applied

**Auto-fix output:**
```
🔧 Auto-Fixing Lint Issues...

📊 Fixes Applied:
   ✅ Fixed [X] unused imports
   ✅ Fixed [X] formatting issues
   ✅ Fixed [X] type errors

📋 Remaining Issues:
   [List issues that require manual fixes]

🔄 Re-running lint...
✅ Linting Checks Passed (after auto-fix)
```

## Important Notes

- **CRITICAL**: Linting must pass before committing code
- Use `--fix` flag to automatically fix common issues
- Some issues require manual fixes (complex type errors, logic issues)
- Run lint before build and test for faster feedback
- Lint errors block commits in `/git:commit` command

## Common Lint Issues

- **Unused imports**: Auto-fixable with `--fix`
- **Type errors**: May require manual fixes
- **Formatting**: Auto-fixable with `--fix`
- **Unused variables**: Auto-fixable with `--fix`
- **Missing types**: Requires manual fixes

## Error Handling

- If npm script fails: Show npm error output
- If no lint config: Show error about missing ESLint config
- If workspace filter fails: Show workspace error

## Related Commands

- `/quality:build` - Run build checks
- `/quality:test` - Run tests
- `/quality:all` - Run all quality gates
- `/git:commit` - Commit (runs lint automatically)

## Agent Reference

- `@lint-build-fix-agent` - Comprehensive lint and build fix agent

## Skill Reference

This command leverages the `quality-gates-skill` for context. See `.claude/skills/quality-gates-skill/SKILL.md` for detailed quality gate guidelines.


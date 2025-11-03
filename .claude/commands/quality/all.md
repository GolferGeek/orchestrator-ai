---
description: "Run all quality gates in sequence: format, lint, test, build"
argument-hint: "[--fix]"
---

# Run All Quality Gates

Run all quality gates in sequence: format, lint, test, and build. This is the complete pre-commit checklist.

**Usage:** `/quality:all [--fix]`

**Examples:**
- `/quality:all` (run all quality gates)
- `/quality:all --fix` (run all gates with auto-fix attempts)

## Process

### 1. Run Format Check

```bash
npm run format
```

**Check:** Code is properly formatted

**If fails:** Format issues detected (should auto-fix)

### 2. Run Lint Check

```bash
npm run lint
```

**Check:** No linting errors

**If fails:**
- If `--fix` flag: Run `npm run lint -- --fix` or invoke `@lint-build-fix-agent`
- Otherwise: Show lint errors

### 3. Run Build Check

```bash
npm run build
```

**Check:** Code compiles without TypeScript errors

**If fails:**
- If `--fix` flag: Invoke `@lint-build-fix-agent` for build fixes
- Otherwise: Show build errors

### 4. Run Test Check

```bash
npm test
```

**Check:** All tests pass

**If fails:**
- If `--fix` flag: Invoke `@test-fix-agent` for test fixes
- Otherwise: Show test failures

### 5. Output Summary

**If all gates pass:**
```
✅ All Quality Gates Passed

📊 Quality Gate Results:
   ✅ Format: Code formatted correctly
   ✅ Lint: No linting errors
   ✅ Build: Compilation successful
   ✅ Test: All tests passing

📋 Summary:
   - Formatted: [X] files
   - Lint: [X] checks passed
   - Build: [X] workspaces built
   - Tests: [X] tests passed

🎉 Ready to commit!

📤 Next Steps:
   - Commit changes: /git:commit
   - Or create PR: /git:pr
```

**If any gate fails:**
```
❌ Quality Gates Failed

📊 Quality Gate Results:
   ✅ Format: Code formatted correctly
   ❌ Lint: [X] linting errors found
   ❌ Build: [X] compilation errors
   ❌ Test: [X] tests failed

📋 Failed Gates:
   [List failed gates with error summaries]

💡 Fix Options:
   1. Use --fix flag: /quality:all --fix
   2. Fix manually and re-run
   3. Use fix agents:
      - @lint-build-fix-agent (for lint/build)
      - @test-fix-agent (for tests)

🔄 Re-run after fixes: /quality:all
```

## Important Notes

- **CRITICAL**: All quality gates must pass before committing code
- This is the complete pre-commit checklist
- Use `--fix` flag to attempt automatic fixes
- Some issues require manual fixes
- Run this before every commit to ensure code quality

## Quality Gate Order

1. **Format** - Ensure code formatting (fastest check)
2. **Lint** - Check code quality (catches common issues)
3. **Build** - Verify compilation (catches type errors)
4. **Test** - Verify functionality (catches logic errors)

**Why this order:**
- Format first (fastest, no dependencies)
- Lint second (catches issues before build)
- Build third (catches type errors before tests)
- Test last (slowest, should run last)

## Auto-Fix Behavior

**With `--fix` flag:**
- Format: Auto-formats code
- Lint: Attempts auto-fix, may invoke `@lint-build-fix-agent`
- Build: May invoke `@lint-build-fix-agent` for type fixes
- Test: May invoke `@test-fix-agent` for test fixes

**Without `--fix` flag:**
- Shows errors but doesn't attempt fixes
- User must fix manually or re-run with `--fix`

## Error Handling

- If format fails: Show formatting issues
- If lint fails: Show lint errors, suggest `--fix` or agent
- If build fails: Show compilation errors, suggest agent
- If test fails: Show test failures, suggest agent
- If any step fails: Stop and show summary

## Related Commands

- `/quality:lint` - Run linting only
- `/quality:build` - Run build only
- `/quality:test` - Run tests only
- `/git:commit` - Commit (runs quality gates automatically)

## Agent Reference

- `@lint-build-fix-agent` - Comprehensive lint and build fix agent
- `@test-fix-agent` - Comprehensive test fix agent

## Skill Reference

This command leverages the `quality-gates-skill` for context. See `.claude/skills/quality-gates-skill/SKILL.md` for detailed quality gate guidelines.


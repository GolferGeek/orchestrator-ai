---
description: "Run tests and optionally auto-fix failures"
argument-hint: "[workspace] [--fix]"
---

# Run Tests

Run test suite across all workspaces or a specific workspace. Optionally attempt to fix test failures using the test-fix-agent.

**Usage:** `/quality:test [workspace] [--fix]`

**Examples:**
- `/quality:test` (run all tests)
- `/quality:test api` (run API tests only)
- `/quality:test web` (run web tests only)
- `/quality:test --fix` (run tests and attempt auto-fix)

## Process

### 1. Determine Test Scope

**If workspace specified:**
- Run tests for specific workspace: `cd apps/<workspace> && npm test`

**If no workspace specified:**
- Run all tests: `npm test` (uses turbo)

### 2. Run Test Command

Execute the test command:

```bash
npm test
```

**What this does:**
- Runs test suites across all workspaces
- Executes unit tests, integration tests
- Reports test results (passed, failed, skipped)
- Shows test coverage (if configured)

### 3. Handle Results

**If tests pass (all green):**
```
✅ Tests Passed

📊 Results:
   ✅ All tests passing
   ✅ [X] tests passed
   ✅ [X] suites passed

📋 Test Summary:
   ✅ apps/api: [X] tests passed
   ✅ apps/web: [X] tests passed
   ... (all workspaces)

📋 Next Steps:
   - Continue with: /quality:build
   - Or run all quality gates: /quality:all
```

**If tests fail (some failures):**
```
❌ Tests Failed

📊 Results:
   ❌ [X] tests failed
   ✅ [X] tests passed
   ⏭️  [X] tests skipped

📋 Failed Tests:
   [List failed test names and errors]

💡 Fix Options:
   1. Review test failures above
   2. Use test-fix-agent: @test-fix-agent
   3. Fix tests manually
```

### 4. Auto-Fix (if --fix flag provided)

**If `--fix` flag provided:**
- Invoke `@test-fix-agent` to analyze and fix test failures
- Show fix attempts and results
- Re-run tests to verify fixes

**Auto-fix output:**
```
🔧 Attempting Test Fixes...

📊 Test Failures:
   [List test failures]

💡 Fix Attempts:
   ✅ Fixed [X] assertion errors
   ✅ Fixed [X] mock setup issues
   ✅ Fixed [X] async/await issues

📋 Remaining Failures:
   [List tests that require manual fixes]

🔄 Re-running tests...
✅ Tests Passed (after auto-fix)
```

## Important Notes

- **CRITICAL**: All tests must pass before committing code
- Test failures block commits in `/git:commit` command
- Some test failures require manual fixes (complex logic issues)
- Run tests after fixing code changes
- Test coverage helps identify untested code

## Common Test Failures

- **Assertion errors**: Expected vs actual value mismatches
- **Mock errors**: Incorrect mock setup or missing mocks
- **Async errors**: Improper async/await handling
- **Type errors**: Type mismatches in test code
- **Setup errors**: Test setup/teardown issues

## Error Handling

- If npm script fails: Show npm error output
- If test config missing: Show config error
- If workspace not found: Show workspace error
- If test timeout: Show timeout error

## Related Commands

- `/quality:lint` - Run linting checks
- `/quality:build` - Run build checks
- `/quality:all` - Run all quality gates
- `/git:commit` - Commit (runs tests automatically)

## Agent Reference

- `@test-fix-agent` - Comprehensive test fix agent

## Skill Reference

This command leverages the `quality-gates-skill` for context. See `.claude/skills/quality-gates-skill/SKILL.md` for detailed quality gate guidelines.


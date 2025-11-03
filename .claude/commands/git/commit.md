---
description: "Commit changes with quality gates and conventional commit message"
argument-hint: "[commit-message]"
---

# Git Commit

Commit changes with automatic quality gate checks and conventional commit message format. This ensures code quality before committing.

**Usage:** `/git:commit [commit-message]`

**Examples:**
- `/git:commit "feat(auth): add user authentication"`
- `/git:commit` (auto-generate commit message from changes)

## Process

### 1. Pre-Commit Quality Gates

Run all quality gates before committing:

```bash
npm run format && npm run lint && npm test && npm run build
```

**If any gate fails:**
- Show errors and stop
- Suggest running `/quality:all --fix` to auto-fix issues
- Or invoke `@lint-build-fix-agent` and `@test-fix-agent` if requested
- Re-run quality gates after fixes

**Maximum fix attempts:** 3 (then stop and show manual fix required)

### 2. Check Git Status

- Run `git status` to see all changes
- Run `git diff` to review changes
- Check current branch name
- Verify not on main/master branch (warn if on main)

### 3. Stage Changes

Stage all changes:
```bash
git add .
```

### 4. Generate Commit Message

**If commit message provided:**
- Use provided message
- Validate conventional commit format

**If no message provided:**
- Analyze staged changes
- Generate conventional commit message from changes
- Show generated message for confirmation

**Conventional Commit Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance task
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Test additions
- `style`: Code style changes

### 5. Create Commit

Create commit with message:

```bash
git commit -m "[commit-message]"
```

**Include metadata:**
```
[commit-message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 6. Output Summary

```
✅ Changes Committed Successfully

📋 Commit Details:
   Hash: [commit-hash]
   Message: [commit-message]
   Branch: [branch-name]
   Files Changed: [X] files

📊 Quality Gates:
   ✅ Format: Passed
   ✅ Lint: Passed
   ✅ Test: Passed
   ✅ Build: Passed

📤 Next Steps:
   - Push changes: git push
   - Create PR: /git:pr
```

## Important Notes

- **CRITICAL**: Quality gates must pass before committing
- Use conventional commit message format
- Never commit to main/master branch directly
- Auto-fix attempts limited to 3 retries
- Commits include Claude Code metadata

## Quality Gate Failures

**If quality gates fail:**
1. Show specific errors
2. Suggest auto-fix: `/quality:all --fix`
3. Or invoke fix agents: `@lint-build-fix-agent`, `@test-fix-agent`
4. Re-run quality gates after fixes
5. Stop after 3 attempts if still failing

## Related Commands

- `/quality:all` - Run all quality gates
- `/git:pr` - Create pull request after commit
- `/git:pr:list` - List open pull requests

## Agent Reference

- `@lint-build-fix-agent` - Auto-fix lint/build issues
- `@test-fix-agent` - Auto-fix test failures

## Skill Reference

This command leverages the `quality-gates-skill` and `conventional-commits-skill` for context. See `.claude/skills/quality-gates-skill/SKILL.md` and `.claude/skills/conventional-commits-skill/SKILL.md` for detailed guidelines.


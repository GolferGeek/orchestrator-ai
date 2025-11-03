---
description: "Process a worktree implementation by reading PRD/plan/architecture, implementing features, and running quality gates"
argument-hint: "[branch-name]"
---

# Process Git Worktree

Process a worktree implementation by reading PRD/plan/architecture documents, implementing features, and running quality gates. This command invokes the worktree-processor-agent for comprehensive implementation.

**Usage:** `/git:worktree:process [branch-name]`

**Examples:**
- `/git:worktree:process feature/user-auth` (process worktree for feature/user-auth branch)
- `/git:worktree:process` (list worktrees to choose from)

## Process

### 1. Identify Worktree

**If branch name provided:**
- Locate worktree: `trees/<branch-name>/`
- Verify worktree exists

**If no branch name:**
- List all worktrees
- Allow user to select which to process

### 2. Load Planning Documents

Search for planning documents in worktree:

- PRD files: `*.prd.md`, `prd.txt`, `PRD.md`
- Plan files: `plan.md`, `PLAN.md`, `*.plan.md`
- Architecture files: `architecture.md`, `ARCHITECTURE.md`, `*.architecture.md`

**Load documents:**
- Read PRD/plan to understand requirements
- Read architecture to understand structure
- Identify implementation tasks

### 3. Check Current Status

**Check worktree status:**
- Git status (what files changed)
- Implementation progress (what's done, what's pending)
- Quality gate status (lint, test, build)

### 4. Invoke Worktree Processor Agent

Invoke `@worktree-processor-agent` for implementation:

```
@worktree-processor-agent

Worktree Processing Request:
- Branch: [branch-name]
- Worktree: trees/<branch-name>/
- PRD: [PRD content]
- Plan: [Plan content]
- Architecture: [Architecture content]
- Current Status: [status]

Process this worktree implementation.
```

**The agent will:**
- Read PRD/plan/architecture
- Identify implementation tasks
- Implement features following architecture
- Run quality gates
- Commit changes with proper messages
- Generate progress report

### 5. Run Quality Gates

After implementation, run quality gates:

```bash
cd trees/<branch-name>
npm run format && npm run lint && npm test && npm run build
```

**If gates fail:**
- Invoke `@lint-build-fix-agent` and `@test-fix-agent`
- Fix issues
- Re-run gates

### 6. Commit Changes

Commit implementation changes:

```bash
cd trees/<branch-name>
git add .
git commit -m "feat(module): implement feature X"
```

### 7. Output Summary

```
✅ Worktree Processing Completed

📦 Worktree: trees/feature-user-auth/
📄 Branch: feature/user-auth

📋 Implementation:
   ✅ Features implemented: [X]
   ✅ Files created/modified: [X]
   ✅ Quality gates: Passed
   ✅ Commits: [X] commits

📊 Progress:
   - Completed: [X] tasks
   - Remaining: [X] tasks
   - Progress: [X]%

📤 Next Steps:
   - Continue implementation: /git:worktree:process feature/user-auth
   - Create PR: /git:pr
   - Review changes: git log
```

## Important Notes

- **CRITICAL**: Agent reads PRD/plan/architecture to understand requirements
- Implementation follows architecture patterns
- Quality gates must pass before committing
- Agent can be invoked multiple times for iterative implementation
- Progress is tracked and reported

## Implementation Process

1. **Read Documents**: PRD, plan, architecture
2. **Identify Tasks**: What needs to be implemented
3. **Implement Features**: Following architecture patterns
4. **Run Quality Gates**: Ensure code quality
5. **Commit Changes**: With proper commit messages
6. **Report Progress**: Show what was done

## Related Commands

- `/git:worktree:create` - Create worktree
- `/git:worktree:list` - List worktrees
- `/git:worktree:remove` - Remove worktree
- `/git:pr` - Create PR after implementation

## Agent Reference

- `@worktree-processor-agent` - Specialized agent for worktree processing

## Skill Reference

This command leverages the `worktree-lifecycle-skill` for context. See `.claude/skills/worktree-lifecycle-skill/SKILL.md` for detailed worktree patterns.


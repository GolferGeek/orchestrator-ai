---
description: "List all git worktrees with their status, ports, and branch information"
argument-hint: ""
---

# List Git Worktrees

List all git worktrees with their status, ports, branch information, and service status.

**Usage:** `/git:worktree:list`

**Examples:**
- `/git:worktree:list` (list all worktrees)

## Process

### 1. Get Worktree List

Use git to list worktrees:

```bash
git worktree list
```

**Also check:**
- List directories in `trees/` directory
- Check which worktrees are active
- Check port usage

### 2. Get Worktree Details

For each worktree, get details:

**From git:**
- Worktree path
- Branch name
- Commit hash
- Status (clean/dirty)

**From directory:**
- Port configuration
- Service status
- Last accessed

### 3. Format Output

Display worktrees in formatted table:

```
📋 Git Worktrees

┌──────────────────────────────┬─────────────────────┬──────────┬─────────────┬──────────────┐
│ Worktree Path                 │ Branch              │ Status   │ Server Port │ Client Port  │
├──────────────────────────────┼─────────────────────┼──────────┼─────────────┼──────────────┤
│ trees/feature-user-auth/      │ feature/user-auth    │ Active   │ 4010        │ 5183         │
│ trees/feature-dashboard/      │ feature/dashboard    │ Active   │ 4020        │ 5193         │
│ trees/fix/login-bug/          │ fix/login-bug        │ Clean    │ 4030        │ 5203         │
└──────────────────────────────┴─────────────────────┴──────────┴─────────────┴──────────────┘

📊 Summary:
   - Total Worktrees: [X]
   - Active: [X]
   - Clean: [X]
   - Dirty: [X]

🔗 Access URLs:
   - feature/user-auth: http://localhost:4010 (server), http://localhost:5183 (client)
   - feature/dashboard: http://localhost:4020 (server), http://localhost:5183 (client)

📤 Next Actions:
   - Remove worktree: /git:worktree:remove [branch-name]
   - Process worktree: /git:worktree:process [branch-name]
```

## Important Notes

- **CRITICAL**: Shows all worktrees including main repository
- Status indicates if worktree has uncommitted changes
- Ports show server and client ports for each worktree
- Active worktrees are those currently in use

## Status Indicators

- **Active**: Worktree is currently checked out or has active services
- **Clean**: No uncommitted changes
- **Dirty**: Has uncommitted changes

## Related Commands

- `/git:worktree:create` - Create new worktree
- `/git:worktree:remove` - Remove worktree
- `/git:worktree:process` - Process worktree implementation

## Skill Reference

This command leverages the `worktree-lifecycle-skill` for context. See `.claude/skills/worktree-lifecycle-skill/SKILL.md` for detailed worktree patterns.


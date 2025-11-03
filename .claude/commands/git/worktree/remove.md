---
description: "Remove a git worktree and clean up resources"
argument-hint: "[branch-name]"
---

# Remove Git Worktree

Remove a git worktree, stop services, and clean up resources. This frees ports and disk space.

**Usage:** `/git:worktree:remove [branch-name]`

**Examples:**
- `/git:worktree:remove feature/user-auth` (remove by branch name)
- `/git:worktree:remove` (list worktrees to choose from)

## Process

### 1. Identify Worktree to Remove

**If branch name provided:**
- Locate worktree: `trees/<branch-name>/`
- Verify worktree exists

**If no branch name:**
- List all worktrees
- Allow user to select which to remove

### 2. Show Worktree Details

Display worktree information:

```
📋 Worktree to Remove

📦 Worktree: trees/feature-user-auth/
📄 Branch: feature/user-auth
📡 Server Port: 4010
🌐 Client Port: 5183
📊 Status: Active

⚠️  This will:
   - Stop all services in this worktree
   - Remove worktree directory
   - Remove git worktree reference
   - Free ports 4010 and 5183
```

**Require confirmation:** User must confirm removal.

### 3. Stop Services

Stop all services running in worktree:

```bash
cd trees/<branch-name>
# Stop services (PM2, npm processes, etc.)
npm run stop 2>/dev/null || true
pkill -f "port.*4010" || true
```

### 4. Remove Worktree

Remove git worktree:

```bash
git worktree remove trees/<branch-name>
```

**Or force remove if needed:**
```bash
git worktree remove --force trees/<branch-name>
```

### 5. Clean Up Directory

Remove worktree directory if still exists:

```bash
rm -rf trees/<branch-name>
```

### 6. Verify Removal

Check worktree was removed:

```bash
git worktree list
```

### 7. Output Summary

```
✅ Git Worktree Removed Successfully

📦 Removed Worktree: trees/feature-user-auth/
📄 Branch: feature/user-auth

📊 Cleanup:
   ✅ Services stopped
   ✅ Processes killed
   ✅ Worktree directory removed
   ✅ Git worktree reference removed
   ✅ Ports 4010 and 5183 freed

📤 Next Steps:
   - Create new worktree: /git:worktree:create [branch-name]
   - List remaining worktrees: /git:worktree:list
```

## Important Notes

- **CRITICAL**: Removes worktree and all local changes (unless committed)
- Services are stopped before removal
- Ports are freed for reuse
- Force remove if worktree has uncommitted changes
- Verify removal to ensure cleanup

## Safety Checks

- Warn if worktree has uncommitted changes
- Warn if worktree is currently checked out
- Require explicit confirmation
- Show what will be removed

## Related Commands

- `/git:worktree:list` - List all worktrees
- `/git:worktree:create` - Create new worktree
- `/git:worktree:process` - Process worktree implementation

## Skill Reference

This command leverages the `worktree-lifecycle-skill` for context. See `.claude/skills/worktree-lifecycle-skill/SKILL.md` for detailed worktree patterns.


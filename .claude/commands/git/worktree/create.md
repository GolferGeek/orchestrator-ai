---
description: "Create a git worktree for parallel development with port isolation"
argument-hint: "[branch-name] [port-offset]"
---

# Create Git Worktree

Create a git worktree for parallel development with automatic port isolation. This allows working on multiple branches simultaneously with isolated ports.

**Usage:** `/git:worktree:create [branch-name] [port-offset]`

**Examples:**
- `/git:worktree:create feature/user-auth` (create with auto-calculated ports)
- `/git:worktree:create feature/user-auth 2` (create with port offset 2)
- `/git:worktree:create` (prompt for branch name)

## Process

### 1. Determine Branch Name

**If branch name provided:**
- Use provided branch name
- Verify branch exists or create it

**If no branch name:**
- Prompt user for branch name
- Or list available branches to choose from

### 2. Determine Port Offset

**If port offset provided:**
- Use provided offset
- Calculate ports: Server = 4000 + (offset * 10), Client = 5173 + (offset * 10)

**If no offset provided:**
- Auto-calculate next available offset
- Check existing worktrees to find available offset

### 3. Invoke Create Worktree Command

Use the existing `/create_worktree` command (or invoke worktree creation script):

```
/create_worktree [branch-name] [port-offset]
```

**What this does:**
- Creates worktree in `trees/<branch-name>/`
- Calculates ports based on offset
- Configures environment variables
- Installs dependencies
- Starts services with isolated ports

### 4. Verify Worktree Creation

Check worktree was created:

```bash
git worktree list
```

### 5. Output Summary

```
✅ Git Worktree Created Successfully

📦 Worktree: trees/feature-user-auth/
📄 Branch: feature/user-auth
📡 Server Port: 4010
🌐 Client Port: 5183

📋 Configuration:
   ✅ Worktree created
   ✅ Ports isolated
   ✅ Environment configured
   ✅ Dependencies installed
   ✅ Services started

🔗 Access URLs:
   - Server: http://localhost:4010
   - Client: http://localhost:5183

📤 Next Steps:
   1. Navigate to worktree: cd trees/feature-user-auth
   2. Start development
   3. List worktrees: /git:worktree:list
   4. Remove when done: /git:worktree:remove feature/user-auth
```

## Important Notes

- **CRITICAL**: Use `/create_worktree` command, never manual `git worktree` commands
- Ports are auto-calculated to avoid conflicts
- Each worktree has isolated ports
- Worktrees are stored in `trees/` directory
- Remove worktrees when done to free resources

## Port Allocation

**Port Calculation:**
- Server Port = 4000 + (offset * 10)
- Client Port = 5173 + (offset * 10)

**Port Map:**
- Main Repo (offset 0): Server 4000, Client 5173
- Worktree 1 (offset 1): Server 4010, Client 5183
- Worktree 2 (offset 2): Server 4020, Client 5193
- Worktree 3 (offset 3): Server 4030, Client 5203

## Related Commands

- `/git:worktree:list` - List all worktrees
- `/git:worktree:remove` - Remove worktree
- `/git:worktree:process` - Process worktree implementation

## Skill Reference

This command leverages the `worktree-lifecycle-skill` for context. See `.claude/skills/worktree-lifecycle-skill/SKILL.md` for detailed worktree patterns.


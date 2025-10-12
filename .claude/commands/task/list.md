---
description: "Show active tasks for a team member"
argument-hint: "person"
---

# List Tasks

Show all active tasks for a team member.

**Usage:** `/task:list <person>`

**Examples:**
- `/task:list matt`
- `/task:list nicholas`
- `/task:list justin`

## Team Members

Valid people:
- `matt`
- `nicholas`
- `justin`

## Process

Parse $ARGUMENTS to extract:
- **Person** (matt, nicholas, or justin)

**File Path Pattern:**
`obsidian/Team Vaults/Matt/Tasks/{person}-tasks.md`

**Steps:**

1. **Validate person** - Must be matt, nicholas, or justin
2. **Read task file** using Obsidian MCP
3. **Extract Active Tasks** section only
4. **Parse tasks** (lines starting with `- [ ]`)
5. **Format for display**

**Output Format:**
```
📋 Active Tasks for {Person}

1. [ ] Task description
2. [ ] Task description  
3. [ ] Task description

Total: {count} active tasks
Last updated: {date}
```

## Shortcuts

If no person specified, show ALL team members:

```
📋 Team Task Summary

Matt (3 tasks):
  1. [ ] Task description
  2. [ ] Task description
  3. [ ] Task description

Nicholas (2 tasks):
  1. [ ] Task description
  2. [ ] Task description

Justin (1 task):
  1. [ ] Task description

Total: 6 active tasks across team
```

## Important Notes

- Only show Active Tasks (not Completed)
- Keep task numbers
- Show checkbox status
- If no tasks, say "No active tasks"


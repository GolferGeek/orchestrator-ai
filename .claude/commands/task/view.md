---
description: "View full task file for a team member"
argument-hint: "person"
---

# View Tasks

Show the complete task file for a team member, including both active and completed tasks.

**Usage:** `/task:view <person>`

**Examples:**
- `/task:view matt`
- `/task:view nicholas`
- `/task:view justin`

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
2. **Read entire task file** using Obsidian MCP
3. **Display formatted content**

**Output Format:**
```
📋 {Person}'s Full Task List
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{Full file contents}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 File: obsidian/Team Vaults/Matt/Tasks/{person}-tasks.md
```

## Shortcuts

**View all team task files:**
If no person specified, show summary stats:

```
📊 Team Task Overview

Matt:
  - Active: 3 tasks
  - Completed: 5 tasks
  - File: matt-tasks.md

Nicholas:
  - Active: 2 tasks
  - Completed: 0 tasks
  - File: nicholas-tasks.md

Justin:
  - Active: 1 task
  - Completed: 0 tasks
  - File: justin-tasks.md

Team Totals: 6 active, 5 completed
```

## Important Notes

- Shows ENTIRE file (Active + Completed + Notes)
- Useful for reviewing progress
- Can be used to see task history
- Maintains all markdown formatting


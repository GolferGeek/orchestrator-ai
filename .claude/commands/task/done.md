---
description: "Mark a task as complete in someone's task list"
argument-hint: "person task-number"
---

# Complete Task

Mark a task as done and move it to the Completed Tasks section.

**Usage:** `/task:done <person> <task-number>`

**Examples:**
- `/task:done matt 3`
- `/task:done nicholas 1`
- `/task:done justin 2`

## Team Members

Valid people:
- `matt`
- `nicholas`  
- `justin`

## Process

Parse $ARGUMENTS to extract:
1. **Person** (first word: matt, nicholas, or justin)
2. **Task number** (second word: number)

**File Path Pattern:**
`obsidian/Team Vaults/Matt/Tasks/{person}-tasks.md`

**Steps:**

1. **Validate person** - Must be matt, nicholas, or justin
2. **Read current task file** using Obsidian MCP
3. **Find task** with that number in Active Tasks
4. **Extract task text** (without number)
5. **Remove from Active Tasks** section
6. **Add to Completed Tasks** section:
   ```markdown
   - [x] {task description}
   ```
7. **Update the "Last Updated" date** to today
8. **Write back** to file using Obsidian MCP

**Output Format:**
```
✅ Task #{number} completed for {Person}!

📋 Completed: {task description}
📁 File: {person}-tasks.md

Remaining active tasks for {Person}: {count}
```

## Important Notes

- Change `- [ ]` to `- [x]`
- Move from Active to Completed section
- Remove the task number when moving to Completed
- Update timestamp
- Keep formatting consistent
- If task not found, report error


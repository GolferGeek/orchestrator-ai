---
description: "Add a task to someone's task list"
argument-hint: "person task-description"
---

# Add Task

Add a new task to a team member's task list in Obsidian.

**Usage:** `/task:add <person> <task description>`

**Examples:**
- `/task:add matt Review the orchestration PRD`
- `/task:add nicholas Set up LangGraph endpoints`
- `/task:add justin Test the agent workflow`

## Team Members

Valid people:
- `matt`
- `nicholas`
- `justin`

## Process

Parse $ARGUMENTS to extract:
1. **Person** (first word: matt, nicholas, or justin)
2. **Task description** (everything after first word)

**File Path Pattern:**
`obsidian/Team Vaults/Matt/Tasks/{person}-tasks.md`

**Steps:**

1. **Validate person** - Must be matt, nicholas, or justin
2. **Read current task file** using Obsidian MCP
3. **Find the last task number** in Active Tasks section
4. **Add new task** with next number:
   ```markdown
   - [ ] {next-number}. {task description}
   ```
5. **Update the "Last Updated" date** to today
6. **Write back** to the file using Obsidian MCP

**Output Format:**
```
✅ Task added to {Person}'s list

📋 Task #{number}: {description}
📁 File: {person}-tasks.md

Active tasks for {Person}: {count}
```

## Important Notes

- Add to **Active Tasks** section (not Completed)
- Use checkbox format: `- [ ] `
- Auto-increment task numbers
- Update timestamp
- Keep formatting consistent


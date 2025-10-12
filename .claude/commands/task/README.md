# Task Management Commands

Simple, clean task management for your team using Obsidian.

---

## 📁 Task Files

**Location:** `obsidian/Team Vaults/Matt/Tasks/`

```
Tasks/
├── matt-tasks.md       ← Matt's tasks
├── nicholas-tasks.md   ← Nicholas's tasks
└── justin-tasks.md     ← Justin's tasks
```

---

## 🎯 Commands

### `/task:add <person> <description>`
Add a new task to someone's list

**Examples:**
```
/task:add matt Review the new agent types
/task:add nicholas Set up LangGraph workflows
/task:add justin Test the deployment pipeline
```

---

### `/task:done <person> <number>`
Mark a task as complete

**Examples:**
```
/task:done matt 3
/task:done nicholas 1  
/task:done justin 2
```

---

### `/task:list <person>`
Show active tasks for someone (or everyone if no name)

**Examples:**
```
/task:list matt        ← Show Matt's tasks
/task:list nicholas    ← Show Nicholas's tasks
/task:list             ← Show ALL team tasks
```

---

### `/task:view <person>`
View full task file with history

**Examples:**
```
/task:view matt        ← View Matt's full file
/task:view nicholas    ← View Nicholas's full file
/task:view             ← View team summary
```

---

## 🎨 Task File Format

Each person's file follows this structure:

```markdown
# {Person}'s Tasks

**Last Updated:** YYYY-MM-DD

---

## Active Tasks

- [ ] 1. First task description
- [ ] 2. Second task description
- [ ] 3. Third task description

---

## Completed Tasks

- [x] Completed task description
- [x] Another completed task

---

## Notes

Any notes or context for this person's tasks.
```

---

## 💡 Use Cases

### **Daily Standup**
```
/task:list          ← See everyone's status
```

### **Assign Work**
```
/task:add nicholas Implement the blog-writer agent
/task:add justin Review Nicholas's PR
```

### **Track Progress**
```
/task:done nicholas 1
/task:list nicholas   ← See what's left
```

### **Review History**
```
/task:view matt   ← See everything Matt's done
```

---

## 🔗 Integration Ideas

### **With Development Workflow**
When Codex completes a phase:
```
/task:add matt Review Phase 3 implementation
```

When Claude finishes testing:
```
/task:done matt 5
/task:add nicholas Deploy Phase 3 to staging
```

### **With n8n Workflows**
Create n8n workflows that:
- Add tasks based on events
- Notify when tasks are completed
- Generate weekly reports

### **With Taskmaster MCP**
Sync Obsidian tasks with project tasks:
```
/task:sync           ← Sync Taskmaster → Obsidian
/task:import matt 5  ← Import Taskmaster task #5 to Matt
```

---

## 🎯 Team Members

Currently configured:
- **matt** - Matt Weber (you!)
- **nicholas** - Intern/developer
- **justin** - Intern/developer

**To add more:** Just create a new `{name}-tasks.md` file!

---

## 🚀 Advanced Features (Future)

Ideas for expansion:
- Priority levels (high/medium/low)
- Due dates
- Task categories/tags
- Time tracking
- Task dependencies
- Recurring tasks
- Task templates
- Notifications via webhooks

---

## 📚 Examples

### **Monday Morning:**
```
/task:list
  → See everyone's status
  → Plan the week
```

### **Assigning Work:**
```
/task:add nicholas Review agent documentation
/task:add nicholas Update intern guide with new patterns
/task:add justin Test the marketing swarm workflow
```

### **End of Day:**
```
/task:done matt 3
/task:done matt 5
/task:list matt
  → See what's left for tomorrow
```

### **Weekly Review:**
```
/task:view matt      ← See everything accomplished
/task:view nicholas  ← Review intern progress
/task:view justin    ← Check completed work
```

---

**Simple, clean, version-controlled task management!** ✅


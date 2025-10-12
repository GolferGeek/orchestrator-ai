# Obsidian Commands

Custom Claude commands for interacting with your Obsidian vault.

---

## 🎯 What's Connected

**MCP Server:** `obsidian-mcp` by StevenStavrakis  
**Vault Path:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai/obsidian`  
**Status:** ✅ Configured and ready!

**Your Vault Structure:**
```
obsidian/
├── Team Vaults/
│   └── Matt/
│       ├── Tech Stack Course/
│       │   ├── Intern-Overview-Tech-Stack.md
│       │   ├── 00-Codebase-Analysis.md
│       │   ├── Quick-Reference.md
│       │   └── README.md
│       └── AI Coding Environment/
│           ├── Intern-Overview-AI-Workflow.md
│           ├── 00-Multi-Agent-Workflow.md
│           ├── n8n-Workflow-Patterns.md
│           ├── Claude-Commands-Possibilities.md
│           └── README.md
```

---

## 🛠️ Available Commands

Commands will be created here as needed. Examples:

### **`/obsidian:update-from-code`**
Auto-generate documentation from codebase

### **`/obsidian:create-lesson`**
Create new lesson in Tech Stack Course

### **`/obsidian:sync-progress`**
Update course materials with latest code

---

## 📚 What the MCP Can Do

The Obsidian MCP provides these capabilities:

1. **Read Notes**
   - Get content of any markdown file
   - Search across vault
   - List files and folders

2. **Write/Update Notes**
   - Create new notes
   - Update existing notes
   - Append to notes
   - Modify frontmatter

3. **Search**
   - Full-text search
   - Tag-based search
   - Metadata filtering

4. **Organize**
   - List files in folders
   - Navigate vault structure
   - Manage tags

---

## 💡 Use Case Ideas

### **For Your Tech Stack Course:**
```
/obsidian:document-feature "Agent Orchestration"
  → Analyzes orchestration code
  → Generates comprehensive lesson
  → Adds to Tech Stack Course folder
  → Links to related concepts
  → Creates exercises
```

### **For Your AI Coding Environment:**
```
/obsidian:workflow-guide "Phase Transitions"
  → Extracts from task logs
  → Documents actual workflow
  → Updates Multi-Agent-Workflow.md
  → Adds real examples
```

### **For Your Interns:**
```
/obsidian:learning-path "Sarah" "Agent Development"
  → Analyzes Sarah's background
  → Creates custom learning path
  → Generates reading list
  → Links to relevant docs
  → Tracks progress
```

### **For Your Blog:**
```
/obsidian:blog-from-feature "Orchestration System"
  → Reads implementation
  → Extracts key concepts
  → Generates blog post
  → Saves to vault
  → Creates Hivearchy outline
```

---

## 🚀 Integration Possibilities

### **With n8n:**
```
/workflow:doc-pipeline
  → n8n workflow processes code
  → Extracts documentation
  → Obsidian MCP writes to vault
  → Auto-publishes to blog
```

### **With Taskmaster:**
```
/task:document <id>
  → Gets task details from Taskmaster
  → Documents implementation
  → Saves to Obsidian
  → Links to related tasks
```

### **With Codebase:**
```
/explain:architecture
  → Reads codebase
  → Generates architecture doc
  → Saves to Tech Stack Course
  → Creates diagrams
  → Links components
```

---

## 🔧 Next Steps

1. **Test the connection** - Try reading a file
2. **Create first command** - Start simple
3. **Build automation** - Chain with other MCPs
4. **Document as you go** - Use it to document itself!

---

## 📖 MCP Documentation

**Package:** `obsidian-mcp`  
**GitHub:** `StevenStavrakis/obsidian-mcp`  
**NPM:** `obsidian-mcp`

**Features:**
- Direct filesystem access (no plugin needed!)
- Read/write markdown files
- Search and query
- Tag management
- Frontmatter handling

---

**Your Obsidian vault is now part of your AI workflow!** 📚✨


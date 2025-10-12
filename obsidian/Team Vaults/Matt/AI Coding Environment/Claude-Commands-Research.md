# Claude Commands - Research & Implementation Ideas

**Date:** 2025-01-12  
**Purpose:** Understand Claude Commands and plan implementation for Orchestrator AI

---

## What Are Claude Commands?

**Definition:** Custom slash commands (like `/analyze-code`) that extend Claude's capabilities with project-specific workflows.

**Format:** Markdown files in `.claude/commands/` directory

**Invocation:** Type `/command-name` in Claude Code to execute

---

## How They Work

### **Basic Structure**

**File:** `.claude/commands/my-command.md`

```markdown
---
description: "Brief description of what this command does"
argument-hint: "What arguments it expects"
model: "claude-3-5-sonnet-20241022" (optional)
---

Your instructions here...

Use $ARGUMENTS to accept dynamic inputs.
```

### **Example: Fix Bug Command**

**File:** `.claude/commands/fix-issue.md`

```markdown
---
description: "Fix a specific GitHub issue"
argument-hint: "issue number"
---

Review and fix the bug described in GitHub issue #$ARGUMENTS.

Steps:
1. Read the issue details
2. Locate the relevant code
3. Implement the fix
4. Write tests
5. Update documentation
```

**Usage:** `/fix-issue 123`

---

## Command Scopes

### **Project-Specific** (Recommended for Teams)
**Location:** `.claude/commands/` in project root  
**Benefit:** All team members get same commands  
**Version Control:** Yes - checked into git

### **Personal**
**Location:** `~/.claude/commands/` in home directory  
**Benefit:** Available across all projects  
**Version Control:** No - stays on your machine

---

## Key Features

### **1. Arguments**
```markdown
Create a new $ARGUMENTS agent with basic functionality.
```
**Usage:** `/create-agent blog-writer`

### **2. Model Selection**
```yaml
---
model: "claude-opus-4-20250514"
---
```
**Benefit:** Use premium models for specific commands

### **3. Multi-Line Instructions**
Commands can be complex, multi-step workflows:
```markdown
---
description: "Complete feature implementation workflow"
---

Implement the feature described in $ARGUMENTS:

1. Review requirements in PRD
2. Create database schema
3. Implement backend services
4. Create API endpoints
5. Build frontend components
6. Write comprehensive tests
7. Update documentation
```

### **4. Metadata**
```yaml
---
description: "Shown in command palette"
argument-hint: "Helps user know what to pass"
tags: ["development", "testing"]
---
```

---

## Current Project State

### **What Exists:**
- ✅ `.claude/settings.local.json` - Permissions configured
- ❌ `.claude/commands/` - Directory doesn't exist yet

### **Permissions Already Configured:**
Matt has already allowed extensive bash commands:
- Git operations (checkout, add, commit, push, merge)
- npm operations (test, build, run)
- Supabase operations (start, db, status)
- Docker operations (logs, ps, stop)
- Testing commands
- File operations

**This means:** Commands can execute complex workflows!

---

## Potential Commands for Orchestrator AI

### **Category: Agent Development**

#### `/create-agent [name]`
```markdown
---
description: "Scaffold a new agent with standard structure"
argument-hint: "agent-name"
---

Create a new agent named $ARGUMENTS:

1. Create agent YAML definition
2. Add to appropriate namespace
3. Create test fixtures
4. Generate basic tests
5. Update agent registry
```

#### `/test-agent [slug]`
```markdown
---
description: "Test an agent end-to-end"
argument-hint: "agent-slug"
---

Test the $ARGUMENTS agent:

1. Load agent definition
2. Execute in CONVERSE mode
3. Execute in PLAN mode
4. Execute in BUILD mode
5. Validate outputs
6. Report results
```

---

### **Category: Development Workflow**

#### `/start-phase [number]`
```markdown
---
description: "Start a new development phase"
argument-hint: "phase number"
model: "gpt-5-codex" (for Codex)
---

Start Phase $ARGUMENTS implementation:

1. Read PRD phase requirements
2. Read orchestration-task-log.md for context
3. List files that need creation/modification
4. Confirm approach with GolferGeek
5. Begin implementation
```

#### `/close-phase [number]`
```markdown
---
description: "Close a development phase (testing, commit, branch)"
argument-hint: "phase number"
model: "claude-opus-4" (for Claude Code)
---

Close Phase $ARGUMENTS:

1. Read Codex's completion notes from task log
2. Run npm run build (fix TypeScript errors)
3. Write comprehensive tests
4. Run migrations if needed
5. Run all tests
6. Create verification report
7. Commit all changes
8. Push to remote
9. Create next phase branch
10. Log closure
```

---

### **Category: Code Quality**

#### `/review-changes`
```markdown
---
description: "Review uncommitted changes"
---

Review all uncommitted changes:

1. Run git status
2. Review each modified file
3. Check for:
   - TypeScript errors
   - Missing tests
   - Security issues
   - Performance concerns
4. Generate review summary
```

#### `/run-full-quality-check`
```markdown
---
description: "Complete code quality verification"
---

Run full quality check:

1. npm run build (report errors)
2. npm run lint (report issues)
3. npm test (report failures)
4. Check test coverage
5. Scan for security issues
6. Generate quality report
```

---

### **Category: Documentation**

#### `/document-feature [name]`
```markdown
---
description: "Generate documentation for a feature"
argument-hint: "feature name"
---

Document the $ARGUMENTS feature:

1. Analyze implementation
2. Generate architecture diagram
3. Write API documentation
4. Create usage examples
5. Add to appropriate docs folder
```

#### `/update-prd [topic]`
```markdown
---
description: "Update PRD with new learnings"
argument-hint: "topic to update"
---

Update PRD regarding $ARGUMENTS:

1. Review current PRD section
2. Incorporate new learnings
3. Maintain consistent format
4. Highlight changes
5. Request review
```

---

### **Category: Agent Coordination**

#### `/status-report`
```markdown
---
description: "Generate current development status"
model: "claude-3-5-sonnet" (for Cursor)
---

Generate status report:

1. Read orchestration-task-log.md
2. Check git status
3. Identify last Codex entry
4. Identify last Claude entry
5. Determine next action needed
6. Format as summary report
```

#### `/handoff-to-claude`
```markdown
---
description: "Prepare handoff from Codex to Claude"
model: "gpt-5-codex" (for Codex)
---

Prepare handoff to Claude:

1. Verify all deliverables complete
2. Run git status (check for untracked files)
3. Create comprehensive completion log entry
4. List files changed with line counts
5. Provide testing focus areas for Claude
6. Document any env var needs
7. Notify GolferGeek
```

---

### **Category: Database**

#### `/create-migration [name]`
```markdown
---
description: "Create a new Supabase migration"
argument-hint: "migration name"
---

Create migration: $ARGUMENTS

1. Generate timestamp
2. Create migration file in apps/api/supabase/migrations/
3. Add schema changes based on requirements
4. Include rollback logic
5. Add to migration tracking
```

#### `/run-migrations`
```markdown
---
description: "Run pending Supabase migrations"
---

Run database migrations:

1. Check current migration status
2. Review pending migrations
3. Run supabase db reset (with confirmation)
4. Verify schema changes
5. Report results
```

---

### **Category: Testing**

#### `/write-tests [file]`
```markdown
---
description: "Generate comprehensive tests for a file"
argument-hint: "path/to/file.ts"
---

Write tests for $ARGUMENTS:

1. Analyze the file's exports
2. Identify testable methods
3. Generate test cases:
   - Happy path (success)
   - Error cases
   - Edge cases
   - Integration points
4. Use AAA pattern (Arrange, Act, Assert)
5. Mock external dependencies
6. Aim for 10-15 tests minimum
```

---

## Implementation Ideas for Discussion

### **Idea 1: Role-Based Command Sets**
Create command subdirectories:
```
.claude/commands/
├── codex/         # Commands for developer agent
├── claude/        # Commands for QA agent
├── cursor/        # Commands for monitor agent
└── shared/        # Available to all
```

### **Idea 2: Workflow Commands**
Commands that map to workflow steps:
- `/codex-start-phase`
- `/codex-complete-phase`
- `/claude-verify-phase`
- `/claude-close-phase`
- `/cursor-status`

### **Idea 3: Agent-Specific Instructions**
Commands that load role context:
- `/role-codex` - Loads developer role + starts work
- `/role-claude` - Loads QA role + starts verification
- `/role-cursor` - Loads monitor role + reports

### **Idea 4: Orchestration Commands**
High-level commands for Matt:
- `/orchestrate-phase` - Guides full phase from start to finish
- `/review-agents` - Checks what all agents have done
- `/coordinate-handoff` - Manages Codex → Claude transition

### **Idea 5: Teaching Commands**
For interns and documentation:
- `/explain [concept]` - Generates explanation of codebase concepts
- `/show-example [pattern]` - Shows code examples of patterns
- `/trace-flow [feature]` - Traces request flow through system

---

## Questions for Matt

### **Scope & Organization**
1. Do you want role-based subdirectories or flat structure?
2. Should commands be agent-specific or shared?
3. Which workflows should be automated first?

### **Command Priorities**
4. What's the most painful/repetitive task to automate?
5. Should we start with Codex commands, Claude commands, or coordination?
6. Do you want commands for your own use (Matt) or just the agents?

### **Integration**
7. Should commands update the task log automatically?
8. Should they enforce the workflow (prevent Codex from committing)?
9. Should they validate phase completion before handoff?

### **Teaching & Sharing**
10. Should commands help explain the codebase to interns?
11. Should there be blog-writing commands (since you want to blog about this)?
12. Should commands help with open-source preparation?

---

## Benefits for Your Project

### **For Agents**
- ✅ Clear, repeatable workflows
- ✅ Reduced context in prompts
- ✅ Enforced role boundaries
- ✅ Easier to onboard new agents

### **For Matt**
- ✅ Less manual orchestration
- ✅ Standardized workflows
- ✅ Easy to refine processes
- ✅ Reusable for future projects

### **For Interns**
- ✅ Learn by seeing command definitions
- ✅ Understand workflow steps
- ✅ Can invoke commands themselves
- ✅ Commands explain as they execute

### **For Teaching/Blogging**
- ✅ Commands can generate explanations
- ✅ Show workflow automation
- ✅ Demonstrate AI coordination
- ✅ Create blog content automatically

---

## Next Steps

1. **Discuss** your ideas for commands (now!)
2. **Prioritize** which commands to build first
3. **Create** initial command set
4. **Test** with actual workflow
5. **Iterate** based on usage
6. **Expand** to cover more scenarios

---

**Ready to discuss!** What are your ideas for Claude Commands in this project? 🚀


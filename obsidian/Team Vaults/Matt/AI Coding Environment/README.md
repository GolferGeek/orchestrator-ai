# AI Coding Environment - Documentation

**Purpose:** Document Matt's multi-agent development workflow and AI coding practices

---

## Documents in This Folder

### 🚀 **START HERE: Intern-Overview-AI-Workflow.md**
**Purpose:** 10-minute high-level intro for new interns  
**Status:** ✅ Ready  
**Contents:**
- What is multi-agent development?
- Meet the three agents (Codex, Claude, Cursor)
- How they work together
- The task log coordination system
- Real workflow examples

**👉 NEW INTERNS: Read this first!**

---

### 📋 **00-Multi-Agent-Workflow.md** (DEEP DIVE)
**Purpose:** Comprehensive documentation of the complete workflow  
**Status:** ✅ Complete  
**Contents:**
- Detailed agent roles and responsibilities
- Task log coordination mechanism
- Development loop step-by-step
- Branch strategy and git workflow
- Design decisions and evolution
- Premium model details
- Real examples and patterns

**👉 EXPERIENCED: Read for full implementation details**

---

## Overview

Matt has developed a sophisticated **three-agent orchestration system** where:

- **Codex (GPT-5)** writes all the code
- **Claude Code (Sonnet 4.5/Opus)** tests, fixes, and commits everything
- **Cursor (Sonnet 3.5)** monitors and reports status

They coordinate through a shared task log file with minimal human intervention.

---

## Quick Links

### For New Interns
1. Read: `Intern-Overview-AI-Workflow.md` (10 min)
2. Watch Matt demonstrate a phase completion
3. Review the task log: `docs/feature/matt/orchestration-task-log.md`
4. Read agent role docs when ready

### For Deep Understanding
1. Read: `00-Multi-Agent-Workflow.md` (30 min)
2. Study role definitions: `docs/feature/matt/role-*.md`
3. Review verification reports: `docs/feature/matt/phase*-verification-claude.md`
4. Observe multiple phase completions

---

## Key Concepts

### **Shared Task Log**
All agents communicate by reading/writing to:
`docs/feature/matt/orchestration-task-log.md`

### **Role Separation**
- **Codex:** Implementation only (no tests, no commits)
- **Claude:** Testing, QA, git operations, migrations
- **Cursor:** Status reporting only

### **Premium Models**
Both dev agents use top-tier models for sophisticated reasoning:
- Codex: GPT-5-Codex
- Claude Code: Sonnet 4.5 or Opus

---

## Documentation Status

- ✅ **Intern Overview** - Ready for onboarding
- ✅ **Detailed Workflow** - Complete technical documentation
- ⏳ **Planning Phase** - To be documented
- ⏳ **`.claude/commands`** - To be documented
- ⏳ **Error Handling** - To be documented
- ⏳ **Decision Protocols** - To be documented

---

## Future Topics

1. **Planning Phase Details** - How PRD/Plan collaboration works
2. **`.claude/commands` System** - How roles are actually invoked
3. **Error Handling** - What happens when things fail
4. **Decision Protocols** - How conflicts get resolved
5. **Scaling Patterns** - Could this work with 4+ agents?

---

## Teaching Applications

### **For Interns:**
- Real-world AI-assisted development
- Role separation in practice
- Quality assurance automation

### **For Bootcamp:**
- Advanced development workflows
- Multi-agent coordination
- Production AI integration

### **For University:**
- Multi-agent systems design
- Coordination protocols
- Human-AI collaboration research

---

**Last Updated:** 2025-01-12  
**Owner:** Matt Weber  
**Status:** Active production workflow


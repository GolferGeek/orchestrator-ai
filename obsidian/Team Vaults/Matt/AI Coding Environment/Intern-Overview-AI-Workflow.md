# Multi-Agent Development Workflow Overview (For Interns)

**Read this first!** This is your 10-minute introduction to how we build code using multiple AI agents working together.

---

## What is This?

**One sentence:** Instead of one person doing everything (code, test, commit), we use three specialized AI agents that work together like a development team.

**Think of it like:** A relay race where each runner has a specific leg, except the runners are AI agents and they're building software.

---

## Why Do We Do This?

### **Traditional Development:**
```
Developer does:
1. Write code
2. Write tests
3. Fix bugs
4. Run linters
5. Commit to git
6. Create branches
... (everything)
```

**Problem:** Switching contexts constantly, easy to forget steps, slow.

---

### **Our Multi-Agent Approach:**
```
Codex (Developer)    → Writes code only
Claude (QA)          → Tests, fixes, commits
Cursor (Monitor)     → Reports status
Matt (Orchestrator)  → Guides overall direction
```

**Benefit:** Each agent focuses on what they do best, no context switching, faster delivery.

---

## Meet The Team

### 🔨 **Codex** (The Developer)
**Model:** GPT-5-Codex (Premium)  
**Job:** Write all the code

**What Codex Does:**
- ✅ Reads requirements (PRD)
- ✅ Implements features
- ✅ Creates services, controllers, repositories
- ✅ Updates task log with progress
- ✅ Says "Done, ready for testing"

**What Codex Does NOT Do:**
- ❌ Write tests
- ❌ Run tests
- ❌ Commit to git
- ❌ Create branches
- ❌ Fix lint errors

**Personality:** Fast, practical, focused on shipping code.

---

### ✅ **Claude Code** (The QA Engineer)
**Model:** Claude Sonnet 4.5 or Opus (Premium)  
**Job:** Test, verify, and commit everything

**What Claude Does:**
- ✅ Reads Codex's code
- ✅ Writes comprehensive tests (10-15 per service)
- ✅ Fixes TypeScript errors
- ✅ Runs database migrations
- ✅ Fixes any bugs found
- ✅ Commits ALL changes (theirs + Codex's)
- ✅ Pushes to remote
- ✅ Creates next branch

**What Claude Does NOT Do:**
- ❌ Implement features (that's Codex)
- ❌ Skip testing to move faster

**Personality:** Thorough, detail-oriented, quality-focused.

---

### 👁️ **Cursor** (The Status Monitor)
**Model:** Claude Sonnet 3.5 (Standard)  
**Job:** Report what's happening

**What Cursor Does:**
- ✅ Reads the task log
- ✅ Summarizes who did what
- ✅ Reports current status
- ✅ Stops and waits for Matt

**What Cursor Does NOT Do:**
- ❌ Write code
- ❌ Make decisions
- ❌ Commit anything

**Personality:** Observer, reporter, patient.

---

## How They Work Together

### **The Task Log (Their Communication)**
Location: `docs/feature/matt/orchestration-task-log.md`

```
| Timestamp           | Agent  | Phase   | Activity        | Notes         |
|---------------------|--------|---------|-----------------|---------------|
| 2025-01-12T15:00:00Z| Codex  | Phase 2 | Implemented X   | 10 files +500 |
| 2025-01-12T17:00:00Z| Codex  | Phase 2 | Phase complete  | Ready for QA  |
| 2025-01-12T18:00:00Z| Claude | Phase 2 | Tested X        | 15 tests pass |
| 2025-01-12T18:30:00Z| Claude | Phase 2 | Committed       | Pushed phase-2|
| 2025-01-12T18:35:00Z| Claude | Phase 3 | Created branch  | Ready for dev |
```

**Think of it like:** A shared notebook where everyone writes what they did.

---

## The Development Loop

### **Step 1: Planning (Before Coding)**
```
Matt + Codex + Claude:
1. Create PRD (Product Requirements Document)
2. Both agents create plans
3. Critique each other's plans
4. Create final plan together
```

**Result:** Clear requirements, everyone understands the work.

---

### **Step 2: Implementation (Codex's Turn)**
```
Codex:
1. Reads task log → checks last status
2. Reads PRD → understands requirements
3. Implements features (code only)
4. Logs progress every 1-2 hours
5. Marks phase complete
6. Notifies Matt
```

**Time:** 2-6 hours depending on phase complexity

**Example Log Entry:**
```
| 2025-01-12T17:00:00Z | Codex | Phase 2 | Phase 2 complete - ready for Claude | 
  Implemented step execution, conversation wiring. 
  15 files changed: +2,847/-123 lines. 
  Notes for Claude: Check orchestration-execution.service.ts:142-189 |
```

---

### **Step 3: Quality Assurance (Claude's Turn)**
```
Claude:
1. Reads task log → sees Codex completion
2. Reads Codex's notes → knows what to focus on
3. Verifies build works
4. Writes 10-15 tests per service
5. Runs database migrations
6. Fixes any issues found (doesn't ask Codex)
7. Creates verification report
8. Commits everything
9. Pushes to remote
10. Creates next phase branch
11. Logs completion
12. Notifies Matt
```

**Time:** 1-3 hours depending on complexity

**Example Commit:**
```
feat(orchestration): Phase 2 - Agent Invocation

Implementation (by Codex):
- OrchestrationExecutionService
- Conversation wiring
- 15 files changed

Testing (by Claude):
- 30 test cases written
- All tests passing
- Fixed 3 TypeScript errors

✅ Build passes
✅ All tests pass

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Codex <noreply@anthropic.com>
```

---

### **Step 4: Status Check (Cursor's Turn)**
```
Matt: "What's the status?"

Cursor:
1. Reads task log
2. Checks git status
3. Reports summary
4. Says "Status report complete. Waiting for restart."
5. Stops
```

**Example Report:**
```
## Current Status

Codex: Phase 2 complete (waiting for context clear)
Claude: Phase 2 closed, Phase 3 branch created
Next: Codex can start Phase 3 immediately
```

---

### **Step 5: Repeat!**
```
Matt clears Codex's context → Codex starts Phase 3
(Loop continues until project complete)
```

---

## Key Design Decisions

### **Why Claude Creates Branches (Not Codex)?**

**Old Way (Confusing):**
- Codex creates branch → develops
- Claude switches back to test
- Branch confusion

**New Way (Better):**
- Codex develops on current branch
- Claude tests on same branch
- Claude commits, then creates NEXT branch
- Less context switching!

---

### **Why Task Log (Not Direct Talk)?**

**Benefits:**
- ✅ Persistent (survives context clears)
- ✅ Auditable (Matt can review)
- ✅ Asynchronous (agents don't need to be running together)
- ✅ Simple (no complex messaging)

---

### **Why Premium Models?**

**Investment:**
- **Codex:** GPT-5-Codex (~$3-5 per million tokens)
- **Claude:** Sonnet 4.5/Opus (~$15-75 per million tokens)

**Why It's Worth It:**
- Sophisticated reasoning
- Complex task handling
- Fewer errors
- Less human intervention needed

---

## What This Means For You (Interns)

### **You'll See:**
- Multiple AI agents working on code
- Task log updating with progress
- Commits with co-author attribution
- Branches being created automatically

### **You Might:**
- Help review agent output
- Learn from how agents structure code
- Contribute to improving agent prompts
- Build your own agent workflows

### **You Won't:**
- Need to manage the agents yourself (at first)
- Worry if agents make mistakes (they do, it's normal)
- Understand everything immediately (takes time!)

---

## Real Example (Simplified)

### **Task:** Add a new agent type called "Summarizer"

**Phase 1: Schema (Week 1)**
```
Codex: Creates database tables, entities
Claude: Tests migrations, commits
Result: Database ready for summarizers
```

**Phase 2: Services (Week 1)**
```
Codex: Implements SummarizerService, repository
Claude: Writes 15 tests, commits
Result: Backend logic complete
```

**Phase 3: API (Week 2)**
```
Codex: Adds controller endpoints
Claude: Tests API endpoints, commits
Result: API ready to use
```

**Phase 4: Frontend (Week 2)**
```
Codex: Builds UI components
Claude: Tests components, commits
Result: Users can create summarizer agents
```

**Total Time:** ~2 weeks with agent collaboration vs ~4 weeks traditional

---

## Common Questions

### **Q: What if agents disagree?**
Matt steps in to make the decision. Agents follow the final PRD.

### **Q: What if tests fail?**
Claude fixes them. If it's a fundamental issue, Claude flags Matt.

### **Q: Can I watch this happening?**
Yes! You can see the task log updating in real-time.

### **Q: Will I use this workflow?**
Maybe! As you get comfortable, you might build with agents too.

---

## The Vision (Future)

**Current:** Matt orchestrates agent handoffs manually

**Goal:** Fully autonomous loop
```
Codex codes → updates log
Claude monitors log → tests automatically
Codex sees completion → starts next phase
(Repeat with minimal human intervention)
```

**Challenge:** How do agents resolve disagreements without human?

---

## Resources

### **See It In Action:**
- Task Log: `docs/feature/matt/orchestration-task-log.md`
- Role Docs: `docs/feature/matt/role-*.md`
- Full Details: `00-Multi-Agent-Workflow.md`

### **Your Role:**
- Watch and learn
- Ask questions
- Suggest improvements
- Eventually build your own workflows!

---

## Your First Week Goals

**By End of Week 1, you should understand:**

✅ We use 3 agents (Codex, Claude, Cursor)  
✅ They communicate via task log  
✅ Codex codes, Claude tests/commits  
✅ Each agent has specific responsibilities  
✅ This is faster than traditional development  

**Don't worry about:**
- ❌ Managing agents yourself
- ❌ Understanding every detail
- ❌ Being ready to use agents (you'll learn!)

---

## Next Steps

1. ✅ Read this overview (done!)
2. ⏭️ Watch a phase get completed (Matt will show you)
3. ⏭️ Read the task log to see history
4. ⏭️ Review agent role documents
5. ⏭️ Learn how Matt orchestrates them

---

**This is cutting-edge AI-assisted development.** You're learning something most developers haven't seen yet! 🚀

**Questions?** Ask Matt - he built this entire system!


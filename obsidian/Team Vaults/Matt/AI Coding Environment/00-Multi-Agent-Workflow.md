# Multi-Agent Development Workflow

**Status:** Production - Actively Used  
**Date:** 2025-01-12  
**Purpose:** Document Matt's multi-agent coding orchestration system

---

## Overview

Matt has developed a **three-agent orchestration system** where each AI agent has a specific, non-overlapping role in the development workflow. The agents coordinate through a shared task log file with minimal human intervention required.

---

## The Three Agents

### 🔨 **Codex** (Developer)
**Platform:** [TBD - likely VS Code or similar]  
**Model:** GPT-5-Codex (Premium)  
**Role:** Feature Implementation  
**Branch:** Works on current phase branch

**Responsibilities:**
- ✅ Implement services, controllers, repositories, entities
- ✅ Make architectural decisions within phase scope
- ✅ Update PRD/plan with learnings
- ✅ Wire up integrations
- ✅ Log progress to task log

**Explicitly NOT Responsible For:**
- ❌ Writing tests (any tests - Claude owns ALL testing)
- ❌ Running tests or verifying coverage
- ❌ Linting or formatting
- ❌ Fixing lint errors
- ❌ Committing to git
- ❌ Pushing to git
- ❌ Creating branches
- ❌ Updating .env files (unless new vars needed - then document)

**Personality:**
- Fast - implement efficiently
- Practical - simple solutions
- Clear - document decisions
- Collaborative - clean handoffs
- Focused - stay in phase scope

---

### ✅ **Claude Code** (QA Engineer)
**Platform:** Cursor (Claude Code mode)  
**Model:** Claude Sonnet 4.5 or Opus (Premium)  
**Role:** Testing, Quality Assurance, Version Control, Database Migrations  
**Branch:** Tests on current phase, creates next phase branch

**Responsibilities:**
- ✅ Verify implementation (build, TypeScript, code quality)
- ✅ Write comprehensive tests (10-15 tests minimum per service)
- ✅ Fix TypeScript errors (doesn't ask Codex)
- ✅ Fix test failures
- ✅ Handle linting
- ✅ **Handle database migrations** (run migrations Codex provides)
- ✅ **Fix migration issues** (can modify migration scripts if needed)
- ✅ Create verification reports
- ✅ Commit ALL files (Codex's + own)
- ✅ Push to remote
- ✅ Create next phase branch for Codex

**Explicitly NOT Responsible For:**
- ❌ Implementing features (that's Codex)
- ❌ Working ahead of Codex
- ❌ Skipping tests to move faster

**Personality:**
- Thorough - don't skip verification
- Detail-oriented - catch edge cases
- Efficient - fix small issues immediately
- Communicative - document everything
- Collaborative - add value through testing

---

### 👁️ **Cursor** (Status Monitor)
**Platform:** Cursor (standard mode)  
**Model:** Claude Sonnet 3.5 (Standard Cursor AI)  
**Role:** Status Reporting Only  
**Branch:** Read-only

**Responsibilities:**
- ✅ Read task log
- ✅ Summarize agent activities
- ✅ Report current status
- ✅ STOP and WAIT for GolferGeek

**Explicitly NOT Responsible For:**
- ❌ Writing code
- ❌ Running tests
- ❌ Making commits
- ❌ Technical decisions
- ❌ Continuing without restart

**Personality:**
- Observer, not participant
- Reports facts, then stops
- Waits for human to restart

---

## Coordination Mechanism

### **Shared State File**
**Location:** `docs/feature/matt/orchestration-task-log.md`

**Format:**
```
| Timestamp           | Agent  | Phase   | Activity        | Description |
|---------------------|--------|---------|-----------------|-------------|
| 2025-10-12T15:20:00Z| Codex  | Phase 2 | Implemented X   | Details...  |
| 2025-10-12T20:00:00Z| Claude | Phase 2 | Verified X      | Details...  |
```

**Purpose:**
- Acts as communication protocol between agents
- Handoff mechanism (Codex → Claude)
- Status tracking for Cursor
- Historical record for Matt

---

## Development Workflow

### **Phase 1: Collaborative Planning** (Before Development)

**Participants:** Codex + Claude Code + Matt

```
1. PRD Development
   - Matt provides initial context/idea
   - Codex drafts PRD version A
   - Claude Code drafts PRD version B
   - Both agents critique each other
   - Matt guides and validates
   - Together create final PRD

2. Plan Creation
   - Codex creates Plan A (from final PRD)
   - Claude Code creates Plan B (from final PRD)
   - Both critique each other's plans
   - Together create "middle plan" (final plan)
   - Matt validates final plan
```

**Key Insight:** This collaborative planning ensures both agents understand the work and cross-check thinking before any code is written.

---

### **Phase 2: Iterative Development** (Implementation Loop)

#### **Step 1: Codex Implements**
```
1. Codex reads task log (check for last completion)
2. Codex reads PRD/plan for current phase requirements
3. Codex implements features
   - Creates services, controllers, repositories
   - Updates modules, wires integrations
   - Follows NestJS patterns
   - NO tests, NO commits
4. Codex logs progress every 1-2 hours
   - Includes file names, counts, design decisions
   - Provides notes for Claude (what to focus on)
5. Codex marks phase complete in task log
   - "Phase N complete - ready for Claude"
   - Implementation summary
   - Notes for Claude (focus areas, integration points)
   - Notes for GolferGeek (new env vars if needed)
6. Codex notifies GolferGeek
7. Matt clears Codex's context
```

**Example Task Log Entry:**
```
| 2025-10-12T19:00:00Z | Codex | Phase 2 | Phase 2 complete - ready for Claude | 
  Implemented step execution, conversation creation, result propagation. 
  15 files changed: +2,847/-123 lines. 
  Notes for Claude: Check conversation creation flow in 
  orchestration-execution.service.ts:142-189 |
```

---

#### **Step 2: Claude Code Tests & Commits**
```
1. Claude reads task log for Codex completion signal
2. Claude reads Codex's notes (focus areas)
3. Claude verifies implementation
   - npm run build (fix TypeScript errors if found)
   - npm test (run existing tests)
   - Code review (error handling, types, edge cases)
4. Claude writes comprehensive tests
   - 10-15 test cases minimum per service
   - Happy path, error cases, edge cases
   - AAA pattern (Arrange, Act, Assert)
   - Mock external dependencies
5. Claude runs database migrations (if provided by Codex)
   - Executes migration scripts
   - Can modify migrations if issues found (more capable with SQL)
   - Verifies schema changes
6. Claude fixes any issues found
   - TypeScript errors
   - Test failures
   - Type mismatches
   - Integration problems
   - Migration script issues
7. Claude creates verification report
   - docs/feature/matt/phaseN-verification-claude.md
   - Build status, test coverage, issues found/fixed
8. Claude updates task log with verification
9. Claude commits and pushes
   - Stage ALL changes (Codex's + own)
   - Detailed commit message with co-author attribution
   - Push to current phase branch
10. Claude creates next phase branch
   - git checkout -b integration/orchestration-phase-N+1
   - Ready for Codex to start immediately
11. Claude logs branch creation in task log
12. Claude logs closure in task log
13. Claude notifies GolferGeek
```

**Example Commit Message:**
```
feat(orchestration): Phase 2 - Agent Invocation

## Phase 2 Complete: Step Execution & Conversation Creation

Implemented step execution service, conversation creation for steps,
and result propagation between steps.

### Implementation (by Codex)
- OrchestrationExecutionService with step lifecycle
- Conversation creation via AgentExecutionGateway
- Result propagation wiring
- Files changed: 15 (+2,847/-123 lines)

### Testing & Verification (by Claude)
- orchestration-execution.service.spec.ts (18 tests)
- orchestration-state.service.spec.ts (12 tests)

### Bug Fixes (by Claude)
- Fixed TypeScript error in step status enum
- Fixed null handling in result propagation

### Verification
✅ Build passes
✅ All tests pass (30 total)
✅ No TypeScript errors
✅ Code review complete

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Codex <noreply@anthropic.com>
```

---

#### **Step 3: Cursor Reports Status** (When Asked)
```
1. Matt asks: "What's the status?"
2. Cursor reads orchestration-task-log.md
3. Cursor reads git status
4. Cursor generates status report
5. Cursor says: "Status report complete. Waiting for restart."
6. Cursor STOPS (doesn't continue)
```

**Example Status Report:**
```markdown
## Current Status (2025-10-12 19:30 UTC)

**Last Codex Entry**: 2025-10-12T19:15:00Z - Phase 2 complete
**Last Claude Entry**: 2025-10-12T20:35:00Z - Closed Phase 2, created Phase 3 branch

### Codex Status
- Current Phase: Phase 2 - COMPLETE
- Last Activity: Implemented step execution and conversation creation
- Files Changed: 15 files (+2,847/-123 lines)
- Status: Waiting for context clear to start Phase 3

### Claude Status
- Current Phase: Phase 2 - CLOSED
- Last Activity: Tested, fixed, committed, pushed, created Phase 3 branch
- Tests Written: 30 test cases across 2 files
- Status: Ready for Codex to start Phase 3

### Next Action
GolferGeek can clear Codex's context and they can start Phase 3 immediately.
Phase 3 branch ready: integration/orchestration-phase-3
```

---

## Key Design Decisions

### ✅ **Why Claude Creates Branches (Not Codex)**

**Previous Problem:**
- Codex would create branch → develop
- Claude needed to switch back to test
- Branch confusion between agents

**Current Solution:**
- Codex develops on current branch
- Claude tests on same branch
- Claude commits, pushes, THEN creates next branch
- **Result:** Each agent stays on one branch during work

**Trade-off:** Minor file mixing between phases (acceptable)

---

### ✅ **Why Task Log (Not Direct Communication)**

**Benefits:**
- **Persistent:** Survives context clears
- **Auditable:** Full history of who did what
- **Asynchronous:** Agents don't need simultaneous context
- **Human-readable:** Matt can review progress
- **Simple:** No complex state management

---

### ✅ **Why Separate Test & Dev Agents**

**Benefits:**
- **Clear Separation:** No confusion about responsibilities
- **Parallel Development:** Codex can move fast without test burden
- **Quality Gate:** Claude ensures everything works before commit
- **Specialized Focus:** Each agent optimizes for their role

---

### ✅ **Why Cursor Just Reports**

**Benefits:**
- **Non-Intrusive:** Doesn't change code or state
- **Quick Status:** Matt gets instant overview
- **No Conflicts:** Can't accidentally interfere with other agents
- **Cost-Effective:** Only runs when needed

---

## Files & References

### **Role Definitions**
Located in: `docs/feature/matt/`
- `role-codex-developer.md` - Codex's instructions
- `role-claude-tester.md` - Claude Code's instructions
- `role-cursor-monitor.md` - Cursor's instructions

### **Coordination Files**
- `orchestration-task-log.md` - Shared task log (PRIMARY)
- `orchestration-system-prd.md` - Product requirements
- `orchestration-system-plan.md` - Implementation plan

### **Verification Reports**
- `phaseN-verification-claude.md` - Claude's phase reports

---

## Workflow Evolution

### **Iteration 1: Original**
- Codex created branches
- Claude had to switch back
- Confusion resulted

### **Iteration 2: Current**
- Claude creates branches after testing
- Less context switching
- Cleaner workflow

**Lesson:** The workflow has been refined through real use and will continue to evolve.

---

## Goals & Vision

### **Current State**
- Codex implements → task log
- Claude tests → task log  
- Cursor monitors → reports
- Matt orchestrates + intervenes as needed

### **Future Vision**
**Goal:** Minimize Matt's intervention

**Ideal Workflow:**
```
1. Codex keeps developing phase after phase
2. Claude keeps testing/committing automatically
3. Cursor gives updates to Matt
4. Matt only intervenes when absolutely needed
```

**Challenges to Solve:**
- Autonomous phase transition (Codex → Claude → Codex loop)
- Error handling without human (how do agents resolve conflicts?)
- Decision making (who decides when to escalate to Matt?)

---

## Key Insights

### **What Makes This Work**

1. **Clear Role Separation**
   - No overlap in responsibilities
   - Each agent knows exactly what they do/don't do

2. **Premium AI Models**
   - **Codex:** GPT-5-Codex (cutting-edge reasoning)
   - **Claude Code:** Sonnet 4.5 or Opus (top-tier Claude)
   - Both are maximum-tier models - capable of complex reasoning
   - Investment in quality enables sophisticated automation

3. **Shared State File**
   - Simple, effective coordination
   - No complex messaging protocol needed

4. **Human in the Loop**
   - Matt orchestrates transitions
   - Matt validates major decisions
   - Matt clears contexts to force clean handoffs

5. **Iterative Refinement**
   - Workflow evolves based on real experience
   - Agents learn from past phases
   - Documentation improves with each iteration

6. **Strong Documentation**
   - Each agent has detailed role doc
   - Common reference documents (PRD, plan, task log)
   - Examples and patterns provided

---

## Comparison to Traditional Development

| Aspect | Traditional | Matt's Multi-Agent |
|--------|-------------|-------------------|
| **Roles** | One dev does everything | Specialized agents |
| **Testing** | Dev writes tests | Separate QA agent |
| **Context** | Dev remembers everything | Task log is memory |
| **Quality** | Code review by humans | Automated by Claude |
| **Speed** | Serial (code → test → commit) | Parallel (both agents work) |
| **Consistency** | Varies by developer | Agents follow rules strictly |

---

## Teaching Applications

### **For Interns:**
- Example of role separation in practice
- Real-world workflow automation
- AI as pair programming partner

### **For Bootcamp:**
- Advanced development workflows
- Quality assurance automation
- Agent orchestration patterns

### **For University:**
- Multi-agent systems design
- Coordination protocols
- Human-AI collaboration

---

## Next Steps for Documentation

1. **Capture the Planning Phase** - How PRD/Plan collaboration works
2. **Decision Making Protocols** - When agents disagree, how is it resolved?
3. **Error Handling** - What happens when tests fail?
4. **`.claude/commands` System** - How are these roles actually invoked?
5. **Scaling Patterns** - Could this work with 4+ agents?

---

**End of Document**


# Phase 0 Archive Decisions

This document tracks all archival decisions made during Phase 0: Aggressive Cleanup.

**Archive Date:** 2025-10-04
**Retention Policy:** Keep until Phase 6 completion, then delete

---

## Archive Structure

```
_archive-phase-0/
├── ARCHIVE-DECISIONS.md (this file)
├── file-based-agents/     # Legacy file-based agent implementations
├── deliverables/          # Legacy deliverables code (consolidated into agent2agent)
└── miscellaneous/         # Other archived code
```

---

## Decision Log

### Decision Template
```
#### [Date] - [Component/File Name]
- **Reason for Archive:** Why was this archived?
- **Impact:** What functionality is affected?
- **Migration Path:** How is this functionality now handled?
- **Rollback Notes:** How to restore if needed?
```

---

## Archival Decisions

### 2025-10-04 - Initial Archive Setup
- **Reason for Archive:** Setting up structure for Phase 0.1 backend triage
- **Impact:** None yet - just setup
- **Migration Path:** N/A
- **Rollback Notes:** Simply delete _archive-phase-0 directory

### 2025-10-04 - Archived agents/base/
- **Reason for Archive:** Legacy file-based agent infrastructure, replaced by agent-platform
- **Impact:** Build now fails with ~50+ import errors (expected)
- **Migration Path:** Evaluate each error - needed functions will be properly integrated into agent2agent or agent-platform
- **Rollback Notes:** `mv _archive-phase-0/agents-base apps/api/src/agents/base`

### 2025-10-04 - Archived agents/dynamic-agents.*
- **Reason for Archive:** Legacy dynamic agent controller, replaced by agent-platform controllers
- **Impact:** Part of file-based agent removal
- **Migration Path:** Agent execution now goes through agent2agent controller
- **Rollback Notes:** `mv _archive-phase-0/dynamic-agents.* apps/api/src/agents/`

### 2025-10-04 - Archived image-agents/
- **Reason for Archive:** Legacy image agent infrastructure
- **Impact:** ImageAgentsModule and ImageAgentsService imports fail
- **Migration Path:** Image handling will be evaluated - may need integration into agent-platform
- **Rollback Notes:** `mv _archive-phase-0/image-agents apps/api/src/image-agents`

### 2025-10-04 - Archived agents/demo/
- **Reason for Archive:** Legacy file-based demo agents that depend on archived agents/base/
- **Impact:** Demo agents no longer compiled or functional, kept as reference only
- **Migration Path:** Agent execution now exclusively through agent-platform (database agents)
- **Rollback Notes:** `mv _archive-phase-0/agents-demo apps/api/src/agents/demo`

### 2025-10-04 - Archived agents/actual/
- **Reason for Archive:** Legacy file-based agents
- **Impact:** File-based agent execution removed
- **Migration Path:** Agent-platform execution
- **Rollback Notes:** `mv _archive-phase-0/agents-actual apps/api/src/agents/actual`

### 2025-10-04 - Archived agents/hidden/
- **Reason for Archive:** Legacy file-based agents
- **Impact:** File-based agent execution removed
- **Migration Path:** Agent-platform execution
- **Rollback Notes:** `mv _archive-phase-0/agents-hidden apps/api/src/agents/hidden`

### 2025-10-04 - Archived agents/my-org/
- **Reason for Archive:** Legacy file-based agents
- **Impact:** File-based agent execution removed
- **Migration Path:** Agent-platform execution
- **Rollback Notes:** `mv _archive-phase-0/agents-my-org apps/api/src/agents/my-org`

### 2025-10-04 - Archived agents/saas/
- **Reason for Archive:** Legacy file-based agents
- **Impact:** File-based agent execution removed
- **Migration Path:** Agent-platform execution
- **Rollback Notes:** `mv _archive-phase-0/agents-saas apps/api/src/agents/saas`

---

## File-Based Agents Archive

### agents/base/ - ARCHIVED
- Contains legacy file-based agent base classes and services
- Includes: implementations, sub-services, services
- Status: Moved to _archive-phase-0/agents-base/

### dynamic-agents.* - ARCHIVED
- Legacy dynamic agent controller and tests
- Status: Moved to _archive-phase-0/

### image-agents/ - ARCHIVED
- Legacy image agent module, service, and controller
- Status: Moved to _archive-phase-0/image-agents/

### agents/demo/ - ARCHIVED
- Demo agents (engineering, finance, marketing, etc.)
- Status: Moved to _archive-phase-0/agents-demo/
- Note: Kept as reference only, non-functional without agents/base/

### agents/actual/ - ARCHIVED
- Actual agents directory
- Status: Moved to _archive-phase-0/agents-actual/

### agents/hidden/ - ARCHIVED
- Hidden agents directory
- Status: Moved to _archive-phase-0/agents-hidden/

### agents/my-org/ - ARCHIVED
- My-org agents directory
- Status: Moved to _archive-phase-0/agents-my-org/

### agents/saas/ - ARCHIVED
- SaaS agents directory
- Status: Moved to _archive-phase-0/agents-saas/

---

## Deliverables Archive

*Decisions about deliverables consolidation will be documented here*

---

## Import References

### Removed Imports
*Track all removed import statements here*

Example:
```
File: apps/api/src/some-file.ts
Removed: import { LegacyAgent } from '../agents/legacy/agent'
Reason: Legacy file-based agent, archived to _archive-phase-0/file-based-agents/
```

---

## Build Error Resolutions

### Evaluation Criteria
For each build error, we evaluate:
1. **Is the code still needed?** (Yes/No)
2. **Is it good quality?** (Yes/No/Refactor)
3. **Is it in the right place?** (Yes/No)

### Resolution Log

*Build error resolutions will be documented here*

Example:
```
#### Error: Cannot find module '../agents/legacy/agent'
- **File:** apps/api/src/some-service.ts
- **Needed?** No
- **Quality?** N/A (not needed)
- **Right Place?** N/A
- **Resolution:** Removed import and usage, archived to _archive-phase-0/file-based-agents/
```

---

## Statistics

- **Total Directories Archived:** 9 (agents/base, dynamic-agents, image-agents, agents/demo, agents/actual, agents/hidden, agents/my-org, agents/saas, deliverables)
- **Total Files Archived:** 2 (dynamic-agents.controller.ts, dynamic-agents.controller.failure.spec.ts)
- **Build Errors Created:** ~157 (intentional - now fixing)
- **Build Errors Fixed:** In progress
- **Deliverables Consolidated:** Moved to agent2agent/deliverables/

*Will be updated as cleanup progresses*

---

## Restoration Instructions

If you need to restore archived code:

1. Identify the archived component in this document
2. Locate the file in `_archive-phase-0/[category]/`
3. Copy the file back to its original location (noted in decision log)
4. Restore any removed imports (documented above)
5. Run `npm run build` to verify

**Note:** After Phase 6, this entire archive will be deleted. Do not rely on it for long-term code preservation.

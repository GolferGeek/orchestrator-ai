# Tech Stack Course - Development Workspace

**Status:** In Progress  
**Owner:** Matt Weber  
**Purpose:** Create comprehensive tech stack training materials for Orchestrator AI

---

## Overview

This directory contains materials for developing a **multi-level tech stack course** that teaches interns and contributors how to understand and work with the Orchestrator AI codebase.

The course covers:
- Architecture overview (Turbo monorepo, NestJS, Vue)
- Agent platform deep dive
- LLM integration and privacy features
- Frontend development patterns
- Testing and deployment
- Hands-on labs and exercises

---

## Documents in This Folder

### 🚀 **START HERE: Intern-Overview-Tech-Stack.md** 
**Purpose:** 10-minute high-level intro for new interns  
**Status:** ✅ Ready  
**Contents:**
- What is Orchestrator AI?
- Tech stack overview (NestJS, Vue, Supabase)
- Agent system basics
- First week goals
- Getting started guide

**👉 NEW INTERNS: Read this first!**

---

### 📋 **00-Codebase-Analysis.md** (DEEP DIVE)
**Purpose:** Comprehensive deep dive into the entire codebase  
**Status:** ✅ Complete - Ready for review  
**Contents:**
- Architecture overview
- Module-by-module breakdown
- Agent type system
- Tech stack deep dives
- Design patterns
- Testing strategies

**👉 ACTION NEEDED:** Matt to review, correct, and discuss

### 📌 **Quick-Reference.md**
**Purpose:** Fast lookup guide for developers  
**Status:** ✅ Complete  
**Contents:**
- One-page summaries
- Command cheat sheets
- Common patterns
- Port reference
- Learning path

---

## Course Development Phases

### ✅ Phase 1: Deep Dive Analysis (COMPLETE)
- [x] Analyze entire codebase
- [x] Understand architecture
- [x] Document key modules
- [x] Identify patterns
- [x] Create analysis document

**Output:** `00-Codebase-Analysis.md`

### 🔄 Phase 2: Discussion & Validation (CURRENT)
**Goal:** Ensure understanding is correct before building course

**Discussion Topics:**
1. Architecture accuracy
2. Missing components
3. Deprecated patterns to avoid
4. Emphasis areas for interns
5. Gotchas and common pitfalls

**Next Steps:**
- Matt reviews analysis
- Clarification discussion
- Corrections and adjustments

### ⏳ Phase 3: Course Structure Design
**Goal:** Define learning paths and modules

**Tasks:**
- [ ] Define learning levels (beginner → advanced)
- [ ] Create module outlines
- [ ] Design progression path
- [ ] Identify prerequisites
- [ ] Plan hands-on labs

**Output:** Course outline and module structure

### ⏳ Phase 4: Content Development
**Goal:** Write detailed learning materials

**Tasks:**
- [ ] Write beginner modules (setup, basics)
- [ ] Write intermediate modules (architecture, development)
- [ ] Write advanced modules (orchestration, optimization)
- [ ] Create code examples
- [ ] Build hands-on labs
- [ ] Record video walkthroughs (optional)

**Output:** Complete course materials

### ⏳ Phase 5: Review & Testing
**Goal:** Validate materials with real interns

**Tasks:**
- [ ] Internal review
- [ ] Pilot with 1-2 interns
- [ ] Gather feedback
- [ ] Iterate and improve
- [ ] Finalize materials

**Output:** Production-ready course

---

## Proposed Course Structure (Draft)

### **Level 0: Welcome & Setup** (1-2 hours)
- What is Orchestrator AI?
- Clone and setup
- Start local development
- Tour of the UI

### **Level 1: Architecture Fundamentals** (4-6 hours)
- Turbo monorepo concepts
- NestJS basics
- Vue + Ionic basics
- Database (Supabase)
- Development workflow

### **Level 2: Agent Platform** (8-10 hours)
- Agent type system
- Runtime execution
- Creating agents
- Testing agents
- Agent authoring best practices

### **Level 3: LLM Integration** (6-8 hours)
- Multi-provider system
- Privacy features (PII, pseudonymization)
- Sovereign routing
- Cost tracking
- Performance optimization

### **Level 4: Frontend Development** (6-8 hours)
- Vue components
- Pinia state management
- API integration
- Composables
- Testing

### **Level 5: Advanced Topics** (8-12 hours)
- Orchestration system
- Custom tool development
- Performance optimization
- Production deployment
- Monitoring and debugging

### **Level 6: Contributing** (4-6 hours)
- Git workflow
- Code review process
- Testing requirements
- Documentation standards
- Common patterns

**Total:** 36-52 hours of learning content

---

## Learning Objectives

### By Level

**Level 1 Completion:**
- Can navigate the codebase
- Understands basic architecture
- Can run local development
- Knows where to find things

**Level 2 Completion:**
- Can create simple agents
- Understands agent execution flow
- Can test agents
- Can read agent definitions

**Level 3 Completion:**
- Understands LLM integration
- Can configure providers
- Knows privacy features
- Can debug LLM issues

**Level 4 Completion:**
- Can build Vue components
- Can integrate with backend
- Understands state management
- Can write frontend tests

**Level 5 Completion:**
- Can build orchestrations
- Can optimize performance
- Understands production concerns
- Can troubleshoot issues

**Level 6 Completion:**
- Can contribute code
- Follows project standards
- Can review PRs
- Writes good documentation

---

## Questions for Discussion

### Content Scope
1. Should we cover every module or focus on core concepts?
2. How deep should we go into each technology?
3. Which areas need the most detail?
4. What can be "learn as needed"?

### Target Audience
5. What's the expected baseline knowledge?
6. Are interns coming from web dev backgrounds?
7. Should we assume any AI/LLM knowledge?
8. What about TypeScript proficiency?

### Delivery Format
9. Documentation only or video + documentation?
10. Interactive labs or just examples?
11. Quizzes/assessments?
12. Live workshops or self-paced?

### Priorities
13. What should interns master vs just be aware of?
14. Which modules are most likely to change?
15. What's the minimum to be productive?
16. What's "nice to have" knowledge?

---

## Resources Needed

### For Course Development
- [ ] Access to production deployments (for screenshots)
- [ ] Sample agent definitions (good examples)
- [ ] Common debugging scenarios
- [ ] Performance benchmarks
- [ ] Security best practices doc

### For Students
- [ ] Development environment setup guide
- [ ] API documentation
- [ ] Code examples repository
- [ ] Testing data/fixtures
- [ ] Troubleshooting guide

---

## Success Metrics

### For the Course
- Time to first successful agent creation
- Intern confidence ratings
- Code review quality over time
- Number of "stupid questions" (want to minimize)
- Intern retention and satisfaction

### For Interns
- Can complete setup independently
- Can create agent within first week
- Can fix simple bugs within two weeks
- Can contribute feature within one month
- Can mentor next intern within two months

---

## Next Steps

### Immediate (This Week)
1. ✅ Complete codebase analysis
2. 🔄 Review and discuss with Matt
3. ⏳ Clarify any misunderstandings
4. ⏳ Identify gaps in analysis

### Short-term (Next 2 Weeks)
5. ⏳ Design course structure
6. ⏳ Create detailed module outlines
7. ⏳ Gather example code
8. ⏳ Plan hands-on labs

### Medium-term (Next Month)
9. ⏳ Write first 3 modules
10. ⏳ Build lab exercises
11. ⏳ Test with 1-2 interns
12. ⏳ Iterate based on feedback

---

## Collaboration Notes

**Working Style:**
- Documents in Obsidian for easy editing
- Code examples in repo
- Regular sync-ups to validate direction
- Iterate based on Matt's feedback

**Review Process:**
- Matt reviews analysis docs
- Discuss gaps and corrections
- Refine before moving to next phase
- Validate with actual use

**Iteration:**
- Start with minimal viable course
- Test with real interns
- Gather feedback continuously
- Expand based on needs

---

## Contact & Coordination

**Owner:** Matt Weber  
**Location:** `/obsidian/Team Vaults/Matt/Tech Stack Course/`  
**Status Updates:** This README  
**Discussion:** Via this document or sync meetings

---

**Last Updated:** 2025-01-12  
**Next Review:** After Matt's feedback on analysis document


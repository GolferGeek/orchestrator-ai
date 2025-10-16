# Initial Agent Building - Progressive Configuration & Testing

**Status**: 🚀 In Progress
**Started**: 2025-10-16
**Location**: `/initial-agent-building/`

---

## 🎯 Overview

This is a **temporary workspace** for systematically building out complete agent configurations with proper plan_structure, deliverable_structure, and io_schema definitions. We'll progressively test each agent type, iterating on file-based definitions until we understand the patterns well enough to build a formal agent management system.

### Current Problem
- 16 agents in database with basic metadata only
- **Zero agents** have plan_structure, deliverable_structure, or io_schema populated
- Can't properly test Plan/Build modes without these schemas
- Need to flesh out agents incrementally and test thoroughly

### Approach
- Export all agents to files (backup)
- Clear database table for clean slate
- Work on one agent at a time: export → modify → load → test → iterate
- Keep only tested, working agents in database
- Build up from simple to complex agent types

---

## 📁 Workspace Structure

```
initial-agent-building/
├── README.md              # Quick reference for developers
├── exported/              # Initial DB export (backup, don't modify)
├── working/               # Active development files
├── archived/              # Unused agents
├── scripts/               # Agent management scripts
│   ├── export-all-agents.ts
│   ├── load-agent.ts
│   ├── export-agent.ts
│   ├── delete-agent.ts
│   └── list-agents.ts
└── package.json           # npm run commands
```

---

## ✅ Setup Phase

### Initial Setup
- [ ] Create folder structure (`exported/`, `working/`, `archived/`, `scripts/`)
- [ ] Write export-all-agents.ts script
- [ ] Write load-agent.ts script
- [ ] Write export-agent.ts script
- [ ] Write delete-agent.ts script
- [ ] Write list-agents.ts script
- [ ] Create package.json with npm run commands
- [ ] Create README.md with usage instructions
- [ ] Test all scripts work correctly

### Database Backup
- [ ] Run export-all-agents script to backup all 16 agents
- [ ] Verify all files created in `exported/` directory
- [ ] Review exported agents list:
  - [ ] demo/blog_post_writer (context)
  - [ ] demo/marketing_swarm (api)
  - [ ] demo/requirements_specialist (api)
  - [ ] global/image-generator-google (function)
  - [ ] global/image-generator-openai (function)
  - [ ] global/image-orchestrator (orchestrator)
  - [ ] demo/finance_manager_orchestrator (orchestrator)
  - [ ] demo/metrics (function)
  - [ ] Other 8 agents
- [ ] Identify which agents to keep vs archive
- [ ] Move non-essential agents to `archived/` folder

### Clean Database
- [ ] **CONFIRM** backup is complete and files verified
- [ ] Run: `DELETE FROM public.agents;` to clear table
- [ ] Verify table is empty: `SELECT COUNT(*) FROM public.agents;`

---

## 🧪 Phase 1: Context Agent - Blog Post Writer

**Agent**: `demo/blog_post_writer`
**Type**: context
**Mode Profile**: plan-build-converse
**Goal**: Full converse, plan, and build mode functionality

### 1.1 File Configuration
- [ ] Copy `exported/demo_blog_post_writer.json` to `working/`
- [ ] Define **plan_structure** (JSON schema)
  ```json
  {
    "title": "string",
    "target_audience": "string",
    "tone": "string",
    "outline": ["string"],
    "key_points": ["string"],
    "seo_keywords": ["string"],
    "estimated_word_count": "number"
  }
  ```
- [ ] Define **deliverable_structure** (JSON schema)
  ```json
  {
    "title": "string",
    "meta_description": "string",
    "content": {
      "introduction": "string",
      "sections": [{"heading": "string", "content": "string"}],
      "conclusion": "string"
    },
    "seo_metadata": {
      "keywords": ["string"],
      "tags": ["string"]
    },
    "word_count": "number"
  }
  ```
- [ ] Define **io_schema** (input/output contract)
  ```json
  {
    "input": {
      "topic": "string (required)",
      "tone": "string (optional: professional|casual|technical|conversational)",
      "length": "string (optional: short|medium|long)",
      "audience": "string (optional)",
      "keywords": ["string (optional)"]
    },
    "output": {
      "type": "deliverable",
      "structure": "<references deliverable_structure>"
    }
  }
  ```
- [ ] Verify LLM config is populated (provider, model, temperature)
- [ ] Review and update mode_profile if needed

### 1.2 Load & Initial Test
- [ ] Load agent: `npm run load-agent working/demo_blog_post_writer.json`
- [ ] Verify agent appears in database
- [ ] Check agent shows in frontend agent list
- [ ] Start conversation with agent (converse mode baseline)

### 1.3 Converse Mode Testing
- [ ] Send simple message: "Hello, what can you help me with?"
- [ ] Verify agent responds appropriately
- [ ] Ask about blog post topics
- [ ] Confirm conversational flow works
- [ ] **Pass criteria**: Natural conversation, helpful responses

### 1.4 Plan Mode Testing
- [ ] Request plan: "Create a plan for a blog post about sustainable gardening"
- [ ] Verify plan is created
- [ ] Check plan follows plan_structure schema
- [ ] Review plan quality and completeness
- [ ] Test plan modification requests
- [ ] **Pass criteria**: Plan created, follows schema, good quality

### 1.5 Build Mode Testing
- [ ] Execute plan to build blog post
- [ ] Verify deliverable is created
- [ ] Check deliverable follows deliverable_structure schema
- [ ] Verify deliverable saved to deliverables table
- [ ] Review content quality
- [ ] Test with different tones and lengths
- [ ] **Pass criteria**: Deliverable created, follows schema, good quality

### 1.6 Iteration & Fixes
- [ ] Document any issues found
- [ ] Delete agent: `npm run delete-agent demo blog_post_writer`
- [ ] Modify `working/demo_blog_post_writer.json`
- [ ] Reload: `npm run load-agent working/demo_blog_post_writer.json`
- [ ] Retest failed scenarios
- [ ] Repeat until all tests pass

### 1.7 Phase 1 Completion
- [ ] All converse, plan, build modes working
- [ ] Schemas validated through testing
- [ ] Agent remains in database (don't delete)
- [ ] Document learnings and patterns discovered

---

## 🌐 Phase 2: API Agent - Marketing Swarm

**Agent**: `demo/marketing_swarm`
**Type**: api
**Mode Profile**: api_full
**Goal**: Real-time polling, n8n integration, deliverables, plans

### 2.1 File Configuration
- [ ] Copy `exported/demo_marketing_swarm.json` to `working/`
- [ ] Define **plan_structure** for n8n workflow execution
  ```json
  {
    "campaign_type": "string",
    "objectives": ["string"],
    "workflow_steps": [
      {
        "step_id": "string",
        "agent": "string",
        "task": "string",
        "dependencies": ["string"]
      }
    ],
    "expected_deliverables": ["string"]
  }
  ```
- [ ] Define **deliverable_structure** for campaign output
  ```json
  {
    "campaign_name": "string",
    "deliverables": [
      {
        "type": "string",
        "title": "string",
        "content": "string",
        "metadata": {}
      }
    ],
    "execution_summary": {
      "agents_used": ["string"],
      "duration_ms": "number",
      "status": "string"
    }
  }
  ```
- [ ] Define **io_schema**
- [ ] Verify api_configuration (n8n webhook endpoint)
- [ ] Check polling configuration

### 2.2 Load & Initial Test
- [ ] Load agent: `npm run load-agent working/demo_marketing_swarm.json`
- [ ] Verify agent in database (alongside blog_post_writer)
- [ ] Check agent in frontend
- [ ] Verify n8n workflow is running and accessible

### 2.3 Immediate Execution Testing
- [ ] Send request for simple campaign
- [ ] Verify n8n webhook receives request
- [ ] Check response is returned
- [ ] Verify deliverable structure matches schema
- [ ] **Pass criteria**: Request → n8n → response flow works

### 2.4 Polling Mode Testing
- [ ] Send request that requires polling (long-running)
- [ ] Verify polling mechanism activates
- [ ] Check status updates are received
- [ ] Confirm final deliverable arrives
- [ ] Test polling timeout handling
- [ ] **Pass criteria**: Long-running tasks complete successfully

### 2.5 Plan Integration Testing
- [ ] Request plan for marketing campaign
- [ ] Verify plan creation
- [ ] Check plan follows plan_structure
- [ ] Execute plan through n8n workflow
- [ ] Verify deliverables match plan expectations
- [ ] **Pass criteria**: Plan → execution → deliverables flow works

### 2.6 Iteration & Fixes
- [ ] Document issues
- [ ] Delete agent if needed
- [ ] Modify file
- [ ] Reload and retest
- [ ] Repeat until passing

### 2.7 Phase 2 Completion
- [ ] All API modes working (immediate + polling)
- [ ] n8n integration validated
- [ ] Plan and deliverable schemas working
- [ ] Agent remains in database
- [ ] Document API agent patterns

---

## ⚙️ Phase 3: Function Agents - Image Generators

**Agents**: `global/image-generator-google`, `global/image-generator-openai`
**Type**: function
**Mode Profile**: function_full
**Goal**: Function execution, image generation, deliverables

### 3.1 Google Image Generator Configuration
- [ ] Copy `exported/global_image-generator-google.json` to `working/`
- [ ] Define **function_code** for Google Imagen API integration
- [ ] Define **deliverable_structure** for image output
  ```json
  {
    "image_url": "string",
    "image_data": "string (base64)",
    "metadata": {
      "prompt": "string",
      "dimensions": {"width": "number", "height": "number"},
      "model": "string",
      "generation_time_ms": "number"
    }
  }
  ```
- [ ] Define **io_schema**
  ```json
  {
    "input": {
      "prompt": "string (required)",
      "size": "string (optional)",
      "style": "string (optional)"
    },
    "output": {
      "type": "deliverable",
      "structure": "<references deliverable_structure>"
    }
  }
  ```
- [ ] Verify Google credentials configuration

### 3.2 OpenAI Image Generator Configuration
- [ ] Copy `exported/global_image-generator-openai.json` to `working/`
- [ ] Define **function_code** for DALL-E integration
- [ ] Define **deliverable_structure** (similar to Google)
- [ ] Define **io_schema**
- [ ] Verify OpenAI credentials configuration

### 3.3 Load Both Agents
- [ ] Load Google agent: `npm run load-agent working/global_image-generator-google.json`
- [ ] Load OpenAI agent: `npm run load-agent working/global_image-generator-openai.json`
- [ ] Verify both in database
- [ ] Check both in frontend (global organization)

### 3.4 Google Generator Testing
- [ ] Send image generation request
- [ ] Verify function executes
- [ ] Check image is generated
- [ ] Verify deliverable structure matches schema
- [ ] Test different prompts and parameters
- [ ] **Pass criteria**: Images generated, deliverables correct

### 3.5 OpenAI Generator Testing
- [ ] Send image generation request to DALL-E
- [ ] Verify function executes
- [ ] Check image quality
- [ ] Verify deliverable structure
- [ ] Test various prompts
- [ ] **Pass criteria**: DALL-E images generated successfully

### 3.6 Error Handling Testing
- [ ] Test with invalid prompts
- [ ] Test with API failures
- [ ] Verify error messages are clear
- [ ] Check deliverable structure for errors
- [ ] **Pass criteria**: Graceful error handling

### 3.7 Iteration & Fixes
- [ ] Document issues
- [ ] Delete agents if needed
- [ ] Modify files
- [ ] Reload and retest

### 3.8 Phase 3 Completion
- [ ] Both image generators working
- [ ] Function execution validated
- [ ] Deliverable structures confirmed
- [ ] Error handling verified
- [ ] Document function agent patterns

---

## 🎼 Phase 4: Simple Orchestrator - Image Orchestrator

**Agent**: `global/image-orchestrator`
**Type**: orchestrator
**Mode Profile**: orchestrator_full
**Goal**: Orchestrate image function agents, step execution

### 4.1 File Configuration
- [ ] Copy `exported/global_image-orchestrator.json` to `working/`
- [ ] Define **plan_structure** for image orchestration
  ```json
  {
    "orchestration_name": "string",
    "image_requests": [
      {
        "id": "string",
        "agent": "image-generator-google | image-generator-openai",
        "prompt": "string",
        "parameters": {}
      }
    ],
    "execution_strategy": "parallel | sequential"
  }
  ```
- [ ] Define **deliverable_structure** for orchestration results
  ```json
  {
    "orchestration_id": "string",
    "images": [
      {
        "request_id": "string",
        "agent_used": "string",
        "image_url": "string",
        "metadata": {}
      }
    ],
    "execution_summary": {
      "total_steps": "number",
      "completed_steps": "number",
      "duration_ms": "number",
      "status": "string"
    }
  }
  ```
- [ ] Define **io_schema**
- [ ] Configure orchestration definition to use image generators

### 4.2 Load & Initial Test
- [ ] Load orchestrator: `npm run load-agent working/global_image-orchestrator.json`
- [ ] Verify agent in database
- [ ] Check agent in frontend
- [ ] Verify it can see image generator agents

### 4.3 Simple Orchestration Testing
- [ ] Request single image through orchestrator
- [ ] Verify orchestration plan created
- [ ] Check step execution
- [ ] Verify correct image generator called
- [ ] Check deliverable aggregation
- [ ] **Pass criteria**: Simple orchestration works end-to-end

### 4.4 Multiple Images Testing
- [ ] Request multiple images (2-3)
- [ ] Test parallel execution
- [ ] Test sequential execution
- [ ] Verify all steps complete
- [ ] Check all deliverables collected
- [ ] **Pass criteria**: Multi-step orchestration successful

### 4.5 Mixed Generators Testing
- [ ] Request images from both Google and OpenAI
- [ ] Verify orchestrator uses both agents
- [ ] Check deliverables from each
- [ ] Verify execution summary is accurate
- [ ] **Pass criteria**: Mixed agent orchestration works

### 4.6 Error Handling Testing
- [ ] Test with one agent failing
- [ ] Verify orchestration handles partial failure
- [ ] Check error reporting in deliverable
- [ ] **Pass criteria**: Graceful degradation

### 4.7 Iteration & Fixes
- [ ] Document issues
- [ ] Delete and modify as needed
- [ ] Reload and retest

### 4.8 Phase 4 Completion
- [ ] Orchestration working end-to-end
- [ ] Step execution validated
- [ ] Deliverable aggregation confirmed
- [ ] Document orchestrator patterns

---

## 🏗️ Phase 5: Complex Orchestrators

### 5A: Requirements Writer Orchestrator (NEW)

**Agent**: `demo/requirements_writer_orchestrator` (to be created from scratch)
**Type**: orchestrator
**Goal**: Create orchestrator that coordinates requirements gathering

#### 5A.1 Design Phase
- [ ] Research what agents would be needed for requirements gathering
- [ ] Define orchestration flow
- [ ] Identify which specialist agents to coordinate
- [ ] Design plan_structure for requirements orchestration
- [ ] Design deliverable_structure for requirements output

#### 5A.2 File Creation
- [ ] Create new file: `working/demo_requirements_writer_orchestrator.json`
- [ ] Define complete agent structure
- [ ] Define **plan_structure**
- [ ] Define **deliverable_structure**
- [ ] Define **io_schema**
- [ ] Configure orchestration definition

#### 5A.3 Load & Test
- [ ] Load orchestrator
- [ ] Verify in database
- [ ] Create requirements gathering request
- [ ] Test plan creation
- [ ] Test orchestration execution
- [ ] Verify deliverables
- [ ] **Pass criteria**: Complete requirements workflow

#### 5A.4 Iteration
- [ ] Document issues and improvements
- [ ] Iterate on configuration
- [ ] Retest until working

#### 5A.5 Completion
- [ ] Requirements orchestrator fully functional
- [ ] Document complex orchestration patterns learned

---

### 5B: Metrics Orchestrator

**Agents**: `demo/finance_manager_orchestrator`, `demo/metrics`
**Type**: orchestrator + function
**Goal**: Coordinate metrics gathering and reporting

#### 5B.1 Metrics Agent Configuration
- [ ] Copy `exported/demo_metrics.json` to `working/`
- [ ] Define **function_code** for metrics gathering
- [ ] Define **deliverable_structure** for metrics output
- [ ] Define **io_schema**
- [ ] Load metrics agent

#### 5B.2 Finance Manager Orchestrator Configuration
- [ ] Copy `exported/demo_finance_manager_orchestrator.json` to `working/`
- [ ] Define **plan_structure** for metrics orchestration
- [ ] Define **deliverable_structure** for financial reports
- [ ] Define **io_schema**
- [ ] Configure to use metrics agent
- [ ] Load orchestrator

#### 5B.3 Testing
- [ ] Request financial metrics report
- [ ] Verify orchestrator creates plan
- [ ] Check metrics agent is called
- [ ] Verify metrics are gathered
- [ ] Check report deliverable
- [ ] **Pass criteria**: Metrics orchestration works

#### 5B.4 Iteration & Completion
- [ ] Fix issues
- [ ] Retest
- [ ] Document patterns

---

## 📊 Progress Tracking

### Agents in Database (Target State)
| Agent | Org | Type | Plan Schema | Deliv Schema | IO Schema | Status |
|-------|-----|------|-------------|--------------|-----------|--------|
| blog_post_writer | demo | context | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| marketing_swarm | demo | api | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| image-generator-google | global | function | N/A | ⬜ | ⬜ | ⬜ Not Started |
| image-generator-openai | global | function | N/A | ⬜ | ⬜ | ⬜ Not Started |
| image-orchestrator | global | orchestrator | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| finance_manager_orchestrator | demo | orchestrator | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| metrics | demo | function | N/A | ⬜ | ⬜ | ⬜ Not Started |
| requirements_writer_orchestrator | demo | orchestrator | ⬜ | ⬜ | ⬜ | ⬜ Not Started |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Blocked

---

## 🔄 Iterative Workflow (Per Agent)

**The core development loop**:

1. **Export** (if already in DB): `npm run export-agent {org} {slug}`
2. **Modify** file in `working/` directory
3. **Delete** (if in DB): `npm run delete-agent {org} {slug}`
4. **Load**: `npm run load-agent working/{filename}.json`
5. **Test** via frontend/API
6. **Document** issues and fixes
7. **Repeat** steps 2-6 until working
8. **Keep** in database, move to next agent

---

## 📝 Testing Checklist (Per Agent)

Use this for each agent as you work through the phases:

- [ ] Agent file has all required fields
- [ ] plan_structure defined (if applicable)
- [ ] deliverable_structure defined
- [ ] io_schema defined
- [ ] Loads to database without errors
- [ ] Appears in frontend agent list
- [ ] Can start conversation
- [ ] Converse mode works (if supported)
- [ ] Plan mode works - plan follows schema
- [ ] Build mode works - deliverable follows schema
- [ ] Deliverables saved and retrievable
- [ ] All mode transitions smooth
- [ ] Error handling works correctly
- [ ] Performance is acceptable

---

## 🎓 Learnings & Patterns

### Schema Patterns Discovered
*Document patterns that work well as we discover them*

- [ ] Best practices for plan_structure
- [ ] Best practices for deliverable_structure
- [ ] Best practices for io_schema
- [ ] Common pitfalls to avoid

### Agent Type Patterns
*Specific patterns per agent type*

#### Context Agents
- [ ] Pattern: ...
- [ ] Example: ...

#### API Agents
- [ ] Pattern: ...
- [ ] Example: ...

#### Function Agents
- [ ] Pattern: ...
- [ ] Example: ...

#### Orchestrators
- [ ] Pattern: ...
- [ ] Example: ...

---

## 🚀 Next Steps After Completion

Once all phases are complete and we understand the patterns:

- [ ] Review all working agent configurations
- [ ] Extract common patterns and schemas
- [ ] Design formal agent definition format
- [ ] Build proper agent management system
- [ ] Create agent validation tools
- [ ] Implement agent versioning
- [ ] Build agent UI builder/editor
- [ ] Migrate from `initial-agent-building/` to formal system
- [ ] Archive this workspace as reference

---

## 📚 Resources

### Related Documents
- [[front-end-testing-guide]] - Testing procedures
- [[store-refactor-plan/detailed-plan]] - Overall architecture
- [[transport-types]] - Type safety documentation

### Database References
- Agents table schema: `apps/api/src/agent-platform/repositories/agents.repository.ts`
- Agent interfaces: `apps/api/src/agent-platform/interfaces/agent-record.interface.ts`

### Scripts Location
- All scripts: `initial-agent-building/scripts/`
- Usage: See `initial-agent-building/README.md`

---

**Note**: This is a temporary, experimental workspace. The goal is rapid iteration and learning, not perfection. Document what works, move fast, and build the formal system once we understand the patterns.

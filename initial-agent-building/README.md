# Initial Agent Building Workspace

**Temporary workspace** for progressively building and testing agent configurations with complete schemas.

📋 **Full Plan**: See [`obsidian/efforts/Matt/current/initial-agent-building.md`](../obsidian/efforts/Matt/current/initial-agent-building.md)

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Export all agents from database (backup)
npm run export-all

# 3. List current agents in database
npm run list-agents

# 4. Work on an agent file in working/
# ... edit working/demo_blog_post_writer.json ...

# 5. Delete agent from database (if exists)
npm run delete-agent demo blog_post_writer

# 6. Load modified agent to database
npm run load-agent working/demo_blog_post_writer.json

# 7. Test via frontend/API
# ... test the agent ...

# 8. Repeat steps 4-7 until working correctly
```

---

## 📂 Directory Structure

```
initial-agent-building/
├── README.md              # This file
├── package.json           # npm scripts
├── exported/              # Initial database export (backup, read-only)
├── working/               # Active development files (edit these)
├── archived/              # Unused agents (optional)
└── scripts/               # Management scripts
    ├── export-all-agents.ts
    ├── export-agent.ts
    ├── load-agent.ts
    ├── delete-agent.ts
    └── list-agents.ts
```

---

## 🛠️ Available Commands

### Export All Agents
Backup all agents from database to `exported/` directory:
```bash
npm run export-all
```

### List Agents
Show all agents currently in database:
```bash
npm run list-agents
```

### Export Single Agent
Export specific agent from database:
```bash
npm run export-agent <org-slug> <agent-slug> [output-dir]

# Examples:
npm run export-agent demo blog_post_writer
npm run export-agent global image-generator-openai working
```

### Load Agent
Load agent from JSON file into database (upsert):
```bash
npm run load-agent <filepath>

# Examples:
npm run load-agent working/demo_blog_post_writer.json
npm run load-agent exported/global_image-generator-openai.json
```

### Delete Agent
Remove agent from database (with confirmation):
```bash
npm run delete-agent <org-slug> <agent-slug>

# Examples:
npm run delete-agent demo blog_post_writer
npm run delete-agent global image-generator-openai
```

---

## 🔄 Development Workflow

**The iterative loop for each agent:**

1. **Export** (if already in DB): `npm run export-agent demo blog_post_writer working`
2. **Edit** file in `working/` directory - flesh out schemas
3. **Delete** (if in DB): `npm run delete-agent demo blog_post_writer`
4. **Load**: `npm run load-agent working/demo_blog_post_writer.json`
5. **Test** via frontend/API
6. **Repeat** steps 2-5 until working
7. **Keep** in database, move to next agent

---

## 📋 Agent File Structure

Each agent JSON file should have:

```json
{
  "organization_slug": "demo",
  "slug": "blog_post_writer",
  "display_name": "Blog Post Writer",
  "description": "Creates compelling blog content...",
  "agent_type": "context",
  "mode_profile": "plan-build-converse",
  "version": "1.0.0",
  "status": "active",
  "yaml": "...",
  "config": {
    "llm_defaults": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "temperature": 0.7
    }
  },
  "plan_structure": {
    "title": "string",
    "outline": ["string"],
    "key_points": ["string"]
  },
  "deliverable_structure": {
    "title": "string",
    "content": "string",
    "metadata": {}
  },
  "io_schema": {
    "input": {
      "topic": "string (required)"
    },
    "output": {
      "type": "deliverable"
    }
  }
}
```

### Key Fields to Populate

**Required:**
- `slug`, `display_name`, `agent_type`, `mode_profile`, `yaml`

**Important for Testing:**
- `plan_structure` - Schema for plans (if agent supports planning)
- `deliverable_structure` - Schema for deliverable output
- `io_schema` - Input/output contract
- `config.llm_defaults` - LLM provider and model
- `function_code` - For function agents

---

## 🎯 Testing Progression

Work through agents in this order:

1. **Phase 1**: Context Agent (`demo/blog_post_writer`)
   - Test: converse, plan, build modes

2. **Phase 2**: API Agent (`demo/marketing_swarm`)
   - Test: real-time polling, n8n integration

3. **Phase 3**: Function Agents (`global/image-generator-*`)
   - Test: function execution, image generation

4. **Phase 4**: Simple Orchestrator (`global/image-orchestrator`)
   - Test: orchestration, step execution

5. **Phase 5**: Complex Orchestrators
   - Test: multi-agent coordination

---

## ⚠️ Important Notes

- **This is temporary** - Not a permanent solution
- **Backup first** - Always `npm run export-all` before deleting agents
- **One at a time** - Focus on one agent until it's working
- **Keep working agents** - Don't delete agents that pass tests
- **Document learnings** - Update plan with patterns discovered

---

## 🔗 Related Resources

- **Full Plan**: `obsidian/efforts/Matt/current/initial-agent-building.md`
- **Testing Guide**: `obsidian/efforts/Matt/agent-roles/agent-documentation/front-end-testing-guide.md`
- **Agents Repository**: `apps/api/src/agent-platform/repositories/agents.repository.ts`
- **Agent Interfaces**: `apps/api/src/agent-platform/interfaces/agent-record.interface.ts`

---

## 💡 Tips

- Use `npm run list-agents` frequently to see current state
- Keep `exported/` as pristine backup - don't modify
- Work in `working/` directory for active development
- Test thoroughly before moving to next agent
- Document patterns that work well in the main plan

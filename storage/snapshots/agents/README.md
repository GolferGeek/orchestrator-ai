# Agent JSON Files - Source of Truth

This directory contains JSON files that are the **source of truth** for agent definitions.

## Workflow: JSON → Database

### 1. Edit JSON Files
Edit the agent JSON files in this directory. Each file represents one agent.

**Example files:**
- `demo_marketing_swarm_langgraph.json`
- `demo_requirements_writer_langgraph.json`
- `demo_metrics_agent_langgraph.json`

### 2. Import to Database

**Option A: Import specific agents**
```bash
# Import a single agent
npm run db:import-agent storage/snapshots/agents/demo_marketing_swarm_langgraph.json

# Import all LangGraph agents
npm run db:import-langgraph-agents
```

**Option B: Generate SQL first, then run it**
```bash
# Generate SQL from JSON files
npm run db:generate-sql-from-json apps/langgraph/sql/insert-api-agents.sql

# Then run the SQL file manually or via psql
psql -h 127.0.0.1 -p 7012 -U postgres -d postgres -f apps/langgraph/sql/insert-api-agents.sql
```

**Option C: Import all agents**
```bash
npm run db:import-all-agents
```

## Export from Database → JSON

To sync database changes back to JSON files:

```bash
# Export a specific agent
npm run db:export-agent demo marketing-swarm-langgraph snapshots/agents

# Export all LangGraph agents
npm run db:export-langgraph-agents

# Export all agents
npm run db:export-all-agents
```

## File Naming Convention

- `demo_<agent-slug>.json` - Agents in the "demo" organization
- `global_<agent-slug>.json` - Global agents (no organization)

## Notes

- **JSON files are the source of truth** - always edit JSON, not SQL
- SQL files are auto-generated and can be regenerated anytime
- Database IDs and timestamps are managed by the database
- The import scripts use `upsert`, so you can safely re-import without duplicates



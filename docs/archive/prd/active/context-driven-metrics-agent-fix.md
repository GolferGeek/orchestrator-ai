---
slug: context-driven-metrics-agent-fix
title: Fix Metrics Agent with Context-Driven SQL Generation
owner: AI Development Team
reviewers: [Technical Lead, Product Owner]
created: 2025-01-26
target-window: 2025-01-26 .. 2025-01-29
success-metrics:
  - Metrics agent generates correct SQL with proper column names (100% accuracy)
  - Agent returns real data or clear "no data available" messages (no hardcoded fallbacks)
  - Demo queries work consistently ("Show me revenue by company", "List KPI performance")
risk-level: low
deps: [existing-metrics-agent, supabase-database]
non-goals:
  - Advanced analytics features (reserved for Phase 2)
  - MCP integration (future enhancement)
  - Complex multi-step workflows
---

## 1. Summary
Fix the existing metrics agent to generate correct SQL queries using context-driven schema definitions instead of incorrect hardcoded column names and sample data fallbacks. This will enable proper database interaction and eliminate the "company_name" column error that prevents the agent from returning real data.

## 2. Problem & Goals
- Problem: Current metrics agent generates SQL with wrong column names (`company_name` instead of `companies.name`) and falls back to hardcoded sample data when queries fail, preventing real database analysis.
- Goals:
  - Generate correct SQL using actual database schema
  - Eliminate hardcoded fallback responses
  - Return real data or proper error handling
  - Enable reliable demo of metrics capabilities

## 3. Scope
- In scope:
  - Fix context.md schema definitions with correct table/column information
  - Update agent function to use context schema for SQL generation
  - Remove hardcoded sample data and fallback responses
  - Test with realistic metrics queries
- Out of scope:
  - Advanced analytics features or reporting
  - MCP server integration
  - Complex workflow orchestration
  - New agent architecture (LangGraph/MCP reserved for Phase 2)

## 4. Deliverables (Definition of Done)
- User-visible deliverables:
  - Metrics agent responds to natural language queries with accurate data
  - Clean error messages when no data exists (no fake responses)
  - Consistent demo capability for business metrics requests
- Internal deliverables:
  - Updated context.md with complete, accurate schema definitions
  - Modified agent function using context-provided schema
  - Removed hardcoded sample data from context file
- Acceptance criteria:
  - Agent generates SQL with correct column names (companies.name not company_name)
  - Queries execute successfully against actual database
  - Returns "No results found" instead of fake sample data when tables are empty
  - Demo queries work: "Show me revenue by company", "List department budgets", "KPI performance summary"

## 5. Constraints & Assumptions
- Constraints: 
  - Must use existing agent architecture (no architectural changes)
  - Must work with current Supabase database schema
  - Must maintain existing security model (read-only access)
- Assumptions: 
  - Database tables exist but may be empty (no seed data)
  - Current LangChain SQL generation can work with proper context
  - Agent context system can provide sufficient schema information

## 6. Technical Plan
- Architecture:
  - Keep existing TypeScript function agent structure
  - Enhance context.md with complete schema definitions
  - Modify agent function to include context in LLM prompts
- Data model changes:
  - No database schema changes required
  - Update context.md with accurate table definitions:
    - companies: id, name, industry, founded_year, created_at, updated_at
    - departments: id, company_id, name, head_of_department, budget, created_at, updated_at
    - kpi_metrics: id, name, metric_type, unit, description, created_at, updated_at
    - kpi_goals: id, department_id, metric_id, target_value, period_start, period_end, created_at, updated_at
    - kpi_data: id, department_id, metric_id, value, date_recorded, created_at, updated_at
- APIs/contracts:
  - No API changes - internal agent function modifications only
- Services/modules to touch:
  - `/apps/api/src/agents/actual/finance/metrics/context.md`
  - `/apps/api/src/agents/actual/finance/metrics/agent-function.ts`
  - Possible: `/apps/api/src/supabase/utils/supabase-tools.ts` (revert hardcoded schema)
- Rollout/feature flags:
  - No rollout needed - direct replacement of existing functionality

## 7. Risks & Mitigations
- Risk: LangChain still uses database discovery instead of context → Test thoroughly and add explicit context inclusion in prompts
- Risk: Database connectivity issues during testing → Use local database or clear error handling
- Risk: Context schema becomes out of sync with actual database → Document schema maintenance process
- Risk: Agent still generates wrong SQL patterns → Add validation and debugging of generated queries

## 8. Test & Verification
- Unit, integration, e2e strategies:
  - Unit tests: Schema parsing and SQL generation logic
  - Integration tests: Agent function with mocked database responses
  - E2E tests: Full agent execution with real database connection
- Manual test plan:
  - Test realistic business queries: "Show me company revenue", "Department performance", "KPI trends"
  - Test edge cases: Empty database, invalid queries, complex joins
  - Test error handling: Clear messages for no data, connection failures
- Success metrics measurement:
  - SQL accuracy: 100% correct table/column references
  - Response quality: Real data or clear error messages (0% hardcoded responses)
  - Demo reliability: Consistent results across multiple test runs

## 9. Work Plan Hints (for Taskmaster)
- Milestones/epics:
  - M1: Context Schema Fix — Complete accurate schema definitions in context.md
  - M2: Agent Function Update — Modify SQL generation to use context schema
  - M3: Testing & Validation — Comprehensive testing with realistic queries
- Suggested task seeds:
  - Remove hardcoded sample data section from context.md
  - Add complete table schema definitions with correct column names
  - Fix remaining "company_name" references in SQL examples
  - Modify agent function to include full context in LLM prompts
  - Test agent with variety of business metrics queries
  - Validate SQL generation accuracy and error handling
  - Create demo script with working metrics queries
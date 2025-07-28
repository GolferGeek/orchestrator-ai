# Supabase SQL Context for Learning

## Database Schema Notes

### Core Application Tables
- **users**: Main user records with `id`, `email`, `display_name`, `created_at`, `updated_at`
- **sessions**: Chat sessions linking to users via `user_id`
- **messages**: Individual messages within sessions
- **agent_conversations**: Direct agent interactions with `agent_name`, `agent_type`, nullable `ended_at`
- **tasks**: Task execution within agent conversations
- **mcp_executions**: MCP tool execution tracking with comprehensive metadata
- **mcp_failures**: Detailed failure analysis for learning
- **mcp_feedback**: User feedback with dual rating system

### KPI Business Tables
- **companies**: Company records with `id`, `name`, `industry`, `founded_year`, `created_at`
- **departments**: Department records with `id`, `company_id`, `name`, `head_of_department`, `budget`, `created_at`
- **kpi_metrics**: Metric definitions with `id`, `name`, `description`, `unit`, `metric_type`, `created_at`
- **kpi_data**: Actual metric values with `id`, `department_id`, `metric_id`, `value`, `date_recorded`, `created_at`
- **kpi_goals**: Target values with `id`, `department_id`, `metric_id`, `target_value`, `period_start`, `period_end`, `created_at`

### Important Schema Details
- All tables use `created_at` and `updated_at` timestamps (NOT created_date/updated_date)
- Foreign keys: `user_id` references users, `agent_conversation_id` and `session_id` are nullable
- Agent conversations don't have an `agent_id` - they use `agent_name` and `agent_type` strings
- MCP executions link to both conversations and sessions (both nullable for flexibility)

### KPI Schema Relationships
- Companies → Departments: `companies.id = departments.company_id`
- Departments → KPI Data: `departments.id = kpi_data.department_id`
- Metrics → KPI Data: `kpi_metrics.id = kpi_data.metric_id`
- **CRITICAL**: No direct `company_id` in `kpi_data` - must join through departments
- KPI data uses `date_recorded` for when metric was measured (DATE type)
- Metric values stored as NUMERIC in `kpi_data.value` and `kpi_goals.target_value`

## Successful Query Patterns

### KPI Business Queries
- For company sales counts: **ALWAYS** join through departments: `FROM companies c JOIN departments d ON c.id = d.company_id JOIN kpi_data k ON d.id = k.department_id JOIN kpi_metrics m ON k.metric_id = m.id`
- For "sales" or "revenue": `WHERE m.name = 'Monthly Revenue'` (exact metric name)
- For "last year": `WHERE EXTRACT(YEAR FROM k.date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE) - 1`
- For company counting: `COUNT(DISTINCT c.id)` (NOT company_id)
- Date filtering: Use `k.date_recorded` column (NOT sale_date)

### Common KPI Query Examples
```sql
-- Count companies with sales last year
SELECT COUNT(DISTINCT c.id) as companies_with_sales
FROM companies c
JOIN departments d ON c.id = d.company_id
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_metrics m ON k.metric_id = m.id
WHERE m.name = 'Monthly Revenue'
AND EXTRACT(YEAR FROM k.date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE) - 1;

-- Get company performance vs goals
SELECT c.name, k.value as actual, g.target_value as target
FROM companies c
JOIN departments d ON c.id = d.company_id
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_goals g ON d.id = g.department_id AND k.metric_id = g.metric_id
JOIN kpi_metrics m ON k.metric_id = m.id
WHERE m.name = 'Monthly Revenue';
```

### User Analytics Queries
- For "active users": `WHERE EXISTS (SELECT 1 FROM agent_conversations WHERE user_id = users.id)`
- For "recent": `WHERE created_at >= NOW() - INTERVAL '7 days'`
- For "this week": `WHERE created_at >= DATE_TRUNC('week', NOW())`
- For "this month": `WHERE created_at >= DATE_TRUNC('month', NOW())`
- For "today": `WHERE created_at >= CURRENT_DATE`

### Agent Conversation Queries
- Always join with users for user details: `LEFT JOIN users ON agent_conversations.user_id = users.id`
- For active conversations: `WHERE ended_at IS NULL`
- For conversation counts: `COUNT(agent_conversations.id)` (not COUNT(*))
- Group by user for per-user metrics: `GROUP BY users.id, users.email, users.display_name`

### MCP Analytics Queries
- For execution success rates: `COUNT(*) FILTER (WHERE status = 'success')`
- For average execution time: `AVG(execution_time_ms)`
- Group by tool for tool-specific metrics: `GROUP BY mcp_name, tool_name`
- For error analysis: `LEFT JOIN mcp_failures ON mcp_executions.id = mcp_failures.execution_id`

### Task Analysis Queries
- Task completion rates: `COUNT(*) FILTER (WHERE status = 'completed')`
- Active tasks: `WHERE status IN ('pending', 'running')`
- Failed tasks: `WHERE status = 'failed'`

## Common Error Patterns & Fixes

### Column Name Issues
**Error**: Using "created_date" or "updated_date"  
**Fix**: Always use "created_at" and "updated_at"

**Error**: Using "agent_id" in conversations table  
**Fix**: Use `agent_name` and `agent_type` instead

**Error**: Using COUNT(*) in JOINs without proper grouping  
**Fix**: Use `COUNT(table.id)` and include all non-aggregated columns in GROUP BY

### Join Pattern Issues
**Error**: INNER JOINs when relationships might be null  
**Fix**: Use LEFT JOINs for nullable foreign keys like `agent_conversation_id` and `session_id`

**Error**: Missing table aliases in complex queries  
**Fix**: Always use short table aliases: `FROM users u JOIN agent_conversations ac ON u.id = ac.user_id`

### Aggregation Issues
**Error**: Missing GROUP BY when using aggregate functions  
**Fix**: Include all non-aggregated columns in GROUP BY clause

**Error**: Using HAVING without GROUP BY  
**Fix**: HAVING requires GROUP BY, use WHERE for non-aggregated filtering

### Date/Time Issues
**Error**: Comparing timestamps without timezone consideration  
**Fix**: Use PostgreSQL date functions like `DATE_TRUNC`, `NOW()`, `CURRENT_DATE`

## Advanced SQL Patterns

### Window Functions
- For ranking: `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC)`
- For running totals: `SUM(count) OVER (ORDER BY date_column ROWS UNBOUNDED PRECEDING)`
- For percentiles: `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms)`

### Common Table Expressions (CTEs)
- Use for complex multi-step queries
- Helpful for user cohort analysis and funnel metrics
- Example pattern:
```sql
WITH user_stats AS (
  SELECT user_id, COUNT(*) as conversation_count 
  FROM agent_conversations 
  GROUP BY user_id
),
active_users AS (
  SELECT user_id FROM user_stats WHERE conversation_count > 5
)
SELECT u.*, us.conversation_count
FROM users u
JOIN user_stats us ON u.id = us.user_id
JOIN active_users au ON u.id = au.user_id;
```

### Time-Series Analysis
- Monthly trends: `DATE_TRUNC('month', created_at)`
- Daily analysis: `DATE_TRUNC('day', created_at)`
- Week-over-week: Use `LAG()` window function with weekly grouping

### Performance Considerations
- Use indexes effectively: filter on `user_id`, `created_at`, `status` columns
- Limit large result sets: always include reasonable LIMIT clauses
- Use EXPLAIN for complex queries to check execution plans

## Feedback Integration

### Learning from Success
When queries execute successfully and receive positive feedback:
- Save the pattern for similar future requests
- Note the specific table joins and WHERE clause patterns
- Remember effective column selections and grouping strategies

### Learning from Failures
When queries fail or receive negative feedback:
- Identify the specific error pattern (syntax, logic, performance)
- Note the correction that was applied
- Avoid similar mistakes in future similar requests

### Context Updates
This file is manually updated by developers based on:
- Recurring query patterns that work well
- Common mistakes and their solutions
- New schema changes or optimizations
- User feedback patterns and preferences
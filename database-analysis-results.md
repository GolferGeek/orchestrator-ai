# Database Analysis Results

## Actual Tables Found in Backup

### Public Schema Tables (from backup):
1. `users` ✅ (expected)
2. `agent_conversations` ✅ (expected)
3. `agent_health_status` ❌ (not in expected schema)
4. `agent_interactions` ❌ (not in expected schema)
5. `agent_relationships` ❌ (not in expected schema)
6. `agents` ❌ (not in expected schema)
7. `cidafm_commands` ✅ (expected)
8. `companies` ✅ (keeping in public schema for now)
9. `deliverables` ✅ (expected)
10. `departments` ✅ (keeping in public schema for now)
11. `human_inputs` ❌ (not in expected schema)
12. `tasks` ✅ (expected)
13. `kpi_data` ✅ (keeping in public schema for now)
14. `kpi_goals` ✅ (keeping in public schema for now)
15. `kpi_metrics` ✅ (keeping in public schema for now)
16. `langgraph_state_history` ❌ (not in expected schema)
17. `langgraph_states` ❌ (not in expected schema)
18. `llm_models` ✅ (expected)
19. `llm_providers` ✅ (expected)
20. `llm_usage` ❌ (not in expected schema)
21. `mcp_executions` ❌ (not in expected schema)
22. `mcp_failures` ❌ (not in expected schema)
23. `mcp_feedback` ❌ (not in expected schema)
24. `mcp_tool_usage` ❌ (not in expected schema)
25. `models` ❌ (not in expected schema)
26. `project_steps` ❌ (not in expected schema)
27. `projects` ✅ (expected)
28. `providers` ❌ (not in expected schema)
29. `role_audit_log` ❌ (not in expected schema)
30. `task_messages` ❌ (not in expected schema)
31. `user_audit_log` ❌ (not in expected schema)
32. `user_cidafm_commands` ❌ (not in expected schema)
33. `user_context` ❌ (not in expected schema)
34. `user_interactions` ❌ (not in expected schema)
35. `user_preferences` ❌ (not in expected schema)
36. `user_privacy_settings` ❌ (not in expected schema)
37. `user_routing_patterns` ❌ (not in expected schema)
38. `user_sessions` ❌ (not in expected schema)
39. `user_usage_stats` ❌ (not in expected schema)

### Migration Tables:
- `supabase_migrations.schema_migrations` (system table, keep)
- `supabase_migrations.seed_files` (system table, keep)

## Expected Tables Missing:
- No company schema found (all KPI tables are in public schema instead)

## Summary:
- **Expected tables found**: 14 out of 14 expected tables (including KPI tables in public schema and project_steps)
- **Unused tables to drop**: 25 tables
- **Company tables**: Keeping in public schema for now

## Tables to Drop (25 total):
1. `public.agent_health_status`
2. `public.agent_interactions`
3. `public.agent_relationships`
4. `public.agents`
5. `public.human_inputs`
6. `public.langgraph_state_history`
7. `public.langgraph_states`
8. `public.llm_usage`
9. `public.mcp_executions`
10. `public.mcp_failures`
11. `public.mcp_feedback`
12. `public.mcp_tool_usage`
13. `public.models`
14. `public.providers`
15. `public.role_audit_log`
16. `public.task_messages`
17. `public.user_audit_log`
18. `public.user_cidafm_commands`
19. `public.user_context`
20. `public.user_interactions`
21. `public.user_preferences`
22. `public.user_privacy_settings`
23. `public.user_routing_patterns`
24. `public.user_sessions`
25. `public.user_usage_stats`
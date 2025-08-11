# Clean Database Export

Generated on: 2025-08-11T13:56:00.359Z
Total Records: 2280

## Files

- `complete-export.json` - All data in single file
- `export-summary.json` - Export statistics and metadata
- `import-to-local.js` - Script to import data to local Supabase
- `[table-name].json` - Individual table data files

## Table Summary

- **users**: success (6 records)
- **profiles**: error (0 records)
- **agent_conversations**: success (71 records)
- **tasks**: success (137 records)
- **projects**: success (3 records)
- **deliverables**: success (4 records)
- **llm_providers**: success (4 records)
- **llm_models**: success (9 records)
- **cidafm_commands**: success (27 records)
- **user_cidafm_commands**: success (0 records)
- **langgraph_states**: success (19 records)
- **project_steps**: success (0 records)
- **human_inputs**: success (0 records)
- **kpi_data**: success (1000 records)
- **kpi_goals**: success (1000 records)

## Usage

### To import to local Supabase:

1. Set up local Supabase: `npm run supabase:start`
2. Run the import: `node import-to-local.js`
3. Update your .env: `SUPABASE_MODE=local`

### To use in production:

Keep `SUPABASE_MODE=cloud` and the data is already cleaned in your cloud instance.

## Notes

- This export contains only core business data
- MCP tables have been cleared
- Unused user tracking tables have been removed
- KPI data has been reduced to manageable size
- All table references updated to use llm_providers/llm_models

# Phase 0 Supabase Reset Report

## Command
- `npm run dev:supabase:reset` (runs `supabase db reset` inside `apps/api`)

## Outcome
- ✅ Reset completed at 2025-10-12T14:11:30Z after hardening migrations.
- Containers restarted cleanly; seed script executed without errors.
- Supabase CLI reported available update (`v2.48.3` vs installed `v2.39.2`); no action taken yet.

## Fixes Applied During Reset
1. **n8n schema bootstrap**  
   - Added defensive schema/table creation to `apps/api/supabase/migrations/20251007190433_add_n8n_marketing_swarm_major_announcement.sql` so workflow seeds no longer assume prior structure.  
   - Backfilled resilient definitions in `apps/api/supabase/migrations/20251009153536_create_n8n_schema.sql` (text IDs to match n8n exports).

2. **Plans table compatibility**  
   - Extended `apps/api/supabase/migrations/202510120001_drop_projects_and_conversation_plans_add_plans.sql` to add missing columns (including `plan_json`) when the table already exists from earlier migrations, preventing comment failures.
3. **Baseline agent fixtures**  
   - Augmented `apps/api/supabase/seed.sql` with low-friction context/api/tool/function agents under the `global` namespace to cover every runner type during early smoke tests.

## Verification Checklist
- Schema recreated without manual intervention.
- No pending migrations after reset (`supabase db reset` exits 0).
- Seed script populated auth demo user, conversations, deliverables, metrics, and baseline agents.

## Follow-up
- Share this report with Claude for Phase 0 verification rerun.
- Consider updating Supabase CLI to v2.48.3 once Phase 0 baseline is locked.

# Phase 0 Lint & Format Baseline

Date: 2025-10-12  
Command: `npm run lint`

## Summary
- ❌ Lint currently fails in both workspaces (API + Web).
- Turbo reported 286 errors and 144 warnings (see highlights below).
- No automatic formatting dry-run available: the existing `format` scripts invoke Prettier with `--write`, so a read-only `--check` run is not supported without script changes.

## High-Impact Lint Violations (API / NestJS)
Source: `apps/api`
- **Unused variables & args** – dozens of errors (e.g., `apps/api/src/movies/movies.service.ts#89`) where temporary error values are captured but never used.
- **Unused exports** – helper functions such as `getTablesByDomain` in `apps/api/src/supabase/utils/supabase-tools.ts#5` flagged as unused.
- **Forbidden CommonJS require** – `apps/api/src/system/system.controller.ts#164` still uses `require()`.
- **DTO imports** – `ArrayMinSize` imported but unused (`apps/api/src/videos/dto/create-video.dto.ts#10`).
- **Webhooks controller** – handler signatures include unused parameters (`apps/api/src/webhooks/webhooks.controller.ts#332`).

## High-Impact Lint Violations (Web / Vue)
Source: `apps/web`
- **`any` usage in tests/components** – numerous warnings across `apps/web/src/components/**/__tests__/*.test.ts`.
- **Unused test helpers** – many `mount`/`pinia`/`vi` imports unused in integration specs.

## Format Command Notes
- Root `npm run format` delegates to `turbo run format`; downstream scripts call Prettier with `--write`.
- Because Phase 0 requires a non-destructive baseline, we skipped executing the write-mode format scripts. A future change should add `format:check` scripts (Prettier `--check`) for safe CI gating.

## Recommendations
1. **Create lint backlog** – Track the specific files above (and others in the lint output) so they can be resolved during the relevant implementation phases.
2. **Add Prettier check scripts** – Introduce `format:check` in each workspace and update the root `format` shortcut to support read-only verification.
3. **Coordinate with Claude** – Tester should capture these existing violations as waivers until we intentionally reduce them.

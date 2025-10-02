# Repository Guidelines

## Project Structure & Module Organization
- `apps/api` — NestJS (TypeScript) backend. Feature files follow Nest patterns: `*.module.ts`, `*.service.ts`, `*.controller.ts`, DTOs as `*.dto.ts`. Unit tests live alongside code as `*.spec.ts`; E2E specs under `apps/api/testing/test/*e2e-spec.ts` and provider scripts under `apps/api/testing/*.js`.
- `apps/web` — Vue 3 + Ionic + Vite frontend. Source in `apps/web/src`, unit tests in `apps/web/tests`, Cypress E2E enabled.
- `scripts/` utilities (LLM tests, DB tools), `deployment/` (PM2/Cloudflare), `docs/`, `assets/`, `schemas/`.
- Environment files: copy `.env.example` → `.env` (plus app-specific examples under `apps/api/`). Never commit secrets.

## Architecture Overview
- Monorepo managed by Turbo workspaces: `apps/api` (NestJS) and `apps/web` (Vue).
- API modules: `llms`, `agents`, `agent-pool`, `tasks` (human loop/approvals), `assets`, `usage`, `projects`, `websocket`.
- LLM providers implement `BaseLLMService` with routing, redaction, and PII services; see `apps/api/src/llms/services/*`.
- Data/auth via Supabase (`apps/api/src/supabase/*`) and Postgres through TypeORM.
- Realtime updates via Socket.IO gateway: `apps/api/src/websocket/task-progress.gateway.ts`.
- Frontend consumes REST + WebSocket endpoints and presents agent workflows (Ionic + Vue).

## Build, Test, and Development Commands
- Root (Turbo workspaces):
  - `npm run dev` — start local API + Web via script.
  - `npm run dev:api` / `npm run dev:web` — run a single app.
  - `npm run build` — build all workspaces; `npm test` — run all tests.
  - `npm run lint` / `npm run format` — ESLint and Prettier across the monorepo.
- API (`apps/api`): `npm run start:dev`, `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.
- Web (`apps/web`): `npm run dev`, `npm run test:unit`, `npm run test:e2e`, `npm run build`.

## Coding Style & Naming Conventions
- TypeScript with 2‑space indentation. Keep imports sorted and unused code removed.
- Linters/formatters: ESLint + Prettier are configured; run `npm run lint && npm run format` before PRs.
- Naming:
  - Backend: NestJS conventions; files kebab‑case, classes/interfaces PascalCase.
  - Frontend: Vue components `PascalCase.vue`; composables `useXxx.ts`.

## Testing Guidelines
- API: Jest unit tests (`*.spec.ts`) and E2E (`*.e2e-spec.ts`). Coverage is collected; no strict threshold—aim ≥80% where practical.
- Web: Vitest for unit (`npm run test:unit`), jsdom environment; Cypress for E2E.
- LLM/provider checks: see `apps/api/testing/*.js`. Require API keys in `.env` (e.g., `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`).

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat(api): add approval workflow`, `fix(web): guard null state`).
- PRs must include: clear description, linked issues, screenshots/GIFs for UI changes, and steps to validate. Update docs and `.env.example` when config changes.
- Before opening a PR: `npm test && npm run lint && npm run build`.

## Security & Configuration Tips
- Manage Supabase locally via root scripts (e.g., `npm run dev:supabase:start`).
- Use `npm run dev:ports` to inspect occupied dev ports. Keep secrets out of logs and code.

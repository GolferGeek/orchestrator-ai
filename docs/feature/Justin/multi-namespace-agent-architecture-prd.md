# Multi-Namespace Agent Architecture PRD

## TL;DR
Reorganize the codebase and runtime so that demo, customer-owned ("my-org"), and future SaaS agent collections coexist cleanly. The API loads all namespaces on boot, while the UI/API session context determines which namespace a user can access. Add frontend toggles and landing page scaffolds for demo vs. my-org, preserve current demo behavior, and lay the groundwork for a later SaaS offering without breaking existing flows.

## Problem
- The current repository intermingles demo-only agents (`agents/actual`) with production intent, making it hard for customers to understand what is theirs versus ours.
- The web UI always serves the demo experience. There is no clear way to preview a customer’s own org structure or swap between demo assets and their forked instance.
- Scaling to a hosted/SaaS tier will require tenant isolation, but the groundwork (namespaces, config, permissions) is not in place.

## Goals & Non-Goals
- **Goals**
  - Rename and restructure directories so demo content is clearly marked (`agents/demo`) while leaving space for `agents/my-org` and `agents/saas`.
  - Load all namespaces at API boot, but expose only the active namespace per request/session.
  - Provide a frontend toggle that appears only when a user has multiple namespace entitlements; demo should always remain a secondary option when present, with non-demo namespaces taking precedence.
  - Scaffold separate landing page themes/templates for demo and my-org (future for SaaS).
  - Require customers—even in demo mode—to supply their own provider keys/env values when they fork.
- **Non-Goals**
  - Implement full multi-tenant billing or auth for SaaS; we only prepare the structure.
  - Automatically migrate customer content into `my-org`; initial population can be manual copies.
  - Replace the existing marketing site or external docs.

## Users & Use Cases
- **Demo presenters (internal sales/ops)**: Need polished demo agents and landing pages ready to show prospects.
- **Customers running their own orchestrator**: Want to flip to their organization’s agents/landing page without touching code.
- **Future SaaS tenants**: Benefit from clean separation and namespace isolation when hosted by Orchestrator AI.

## Requirements

### Repository Restructure
1. Rename `apps/api/src/agents/actual` → `apps/api/src/agents/demo`; update imports/tests to match.
2. Create empty directories (with README placeholders) for `apps/api/src/agents/my-org` and `apps/api/src/agents/saas`.
3. Under `agents/saas/`, support per-tenant subfolders (e.g., `agents/saas/ifm`) so each hosted customer keeps an isolated agent tree.
4. Mirror the same structure on the frontend for static content (e.g., `apps/web/src/data/agents/demo`, `.../my-org`).
5. Update build scripts and generators (e.g., Agent Creator tooling) to respect the new folder names and SaaS subdirectories.

### Runtime Namespace Handling (API)
1. Introduce a namespace config (e.g., env var `AGENT_NAMESPACES=demo:agents/demo,my-org:agents/my-org,saas-ifm:agents/saas/ifm`) so each entry maps to a specific directory.
2. Extend the agent factory/context loader to scan all configured namespaces during startup and cache them separately.
3. Add middleware that resolves `activeNamespace` per request based on session/user preferences or query param.
4. Restrict namespace visibility using a per-user namespace list stored on the profile (e.g., JSON array like `{"demo": true, "saas-ifm": true}`); users default to their primary non-demo namespace (e.g., `my-org` or `saas-ifm`), while demo appears only as an optional secondary context for internal staff.
5. Ensure logging, metrics, and caching differentiate namespaces to prevent cross-bleed.
6. Surface the namespace list via the existing user/profile API (e.g., add a `namespace_access` JSONB column on `public.users` and include it in auth payloads) so the frontend can cache it locally without extra round trips.

### Frontend Behavior
1. Introduce a global “Experience” toggle that appears automatically when a user has access to more than one namespace (e.g., both `demo` and `my-org`).
2. Persist the selection (local storage + route guard) so sessions open in the primary non-demo namespace; demo can be selected manually when a user has access to both.
3. Load agent lists, context, and conversations from the active namespace via API parameters.
4. Duplicate landing page routes/components: `LandingDemo.vue`, `LandingMyOrg.vue`, with ability to customize the latter.
5. Leave SaaS landing placeholder components for future development.
6. Immediately disable public signup flows on the existing UI (hide `/signup`, remove "Don't have an account" prompts) so only provisioned accounts can log in.
7. Guard the registration view so only authenticated admins (via feature flag/role check) can reach it when we expose internal user-creation UX.
8. Read the `namespace_access` payload from the auth/profile response and hydrate it into the auth/user store for reuse across views (no separate API call required).

### Configuration & Credentials
1. Update environment templates (`.env.example`, docs) to highlight per-namespace provider keys; customers set theirs post-fork.
2. Validate that the demo experience still runs with the user’s keys when the toggle sits on demo.
3. Document instructions for copying a demo agent into `my-org` as a starting point.

### User Provisioning & Permissions
1. Maintain manual user creation flows (internal ops or customer admins invite users; no public signup for now).
2. On user creation, populate a namespace access list (JSON structure) with entries like `my-org` or `saas-ifm`; demo access is granted explicitly as needed and should never be the primary namespace for external tenants.
3. For SaaS tenants, ensure all agents live under their dedicated subfolder (e.g., `agents/saas/ifm`) and only users with the matching namespace entry can view/execute them.
4. Restrict the register screen so only authenticated admins can invoke it (e.g., via hidden route or modal); until that UX exists, rely on CLI/Supabase console commands.
5. Update backend admin tooling/scripts to write the `namespace_access` JSONB column whenever accounts are provisioned.

### Tooling & Docs
1. Update onboarding docs to describe the namespace model and how to toggle views.
2. Add README.md files under each namespace directory explaining their purpose and ownership.
3. Provide a CLI or script option to copy agents from `demo` to `my-org` (optional v1).
4. Place internal landing page variants (`apps/web/src/views/landing/my-org`, `.../landing/saas`, shared components) under `.gitignore` alongside the private agent directories so customer forks start with empty shells.

## Acceptance Criteria
- Repository contains `agents/demo`, `agents/my-org`, `agents/saas` directories with tests/build passing.
- API recognizes multiple namespaces and routes requests to the active one without regression.
- Users with multiple namespace assignments in their profile can switch between them; single-namespace users see only their assigned experience.
- Landing page renders the correct variant based on namespace selection.
- Existing demo workflows remain functional with minimal friction for presenters.
- SaaS tenant subfolders (e.g., `agents/saas/ifm`) load only for users granted the corresponding namespace access entry.
- Public self-signup is disabled; only pre-provisioned accounts can log in, and demo is available solely as a secondary namespace for those users.

## Delivery Plan

### Phase 0 – Planning
- Audit all references to `agents/actual` in API/frontend/tests.
- Align on naming conventions for env vars and namespace identifiers.

### Phase 1 – Repo Restructure
- Rename directories and update imports/tests.
- Add placeholders for new namespaces; update documentation.
- Separate internal-only namespaces (`my-org`, `saas`) from the public starter template (e.g., private branch or copy script) so customer forks do not receive proprietary agents.
  - As an interim step (until agents live in the database), ensure release packaging strips `agents/my-org` and populated `agents/saas/*` directories from any shared/forkable artifacts (e.g., add these directories to `.gitignore` in public repos).

### Phase 2 – API Namespace Support
- Implement namespace config and loader changes.
- Add request scoping middleware and adjust endpoints to accept `namespace` parameter.
- Write unit/integration tests ensuring isolation.

### Phase 3 – Frontend Toggle & Routing
- Build experience toggle driven by namespace entitlements and persistence mechanics.
- Update API calls to include namespace context.
- Duplicate landing pages and adjust routing/guards.

### Phase 4 – Docs & Tooling
- Refresh onboarding docs and env examples.
- Provide optional copy script instructions.
- Verify end-to-end flows for demo and my-org users.
- Document the interim manual user provisioning process and any admin UI workarounds.
- Outline the process for keeping internal namespaces out of shared forks (e.g., `.gitignore`, release packaging guidance).
  - Capture roadmap notes for migrating agent definitions into database storage (including namespace tagging) so filesystem stubs can eventually be removed.

## Dependencies & Risks
- **Dependency**: Profile storage must support per-user namespace assignments (e.g., JSON field listing `demo`, `my-org`, `saas-ifm`).
- **Dependency**: User provisioning remains manual (internal ops or customer admins); tooling must let them edit namespace access lists.
- **Dependency**: Auth service must block anonymous/public signup endpoints so only provisioned accounts can authenticate.
- **Risk**: Rename could break imports or generator scripts; requires careful search/replace and testing.
- **Risk**: Concurrent editing of shared JSON/context files across namespaces could be confusing; documentation needed.
- **Risk**: Without automation, customers might forget to populate `my-org`; consider templates or wizards later.
- **Risk**: Forgetting to strip `my-org`/`saas` directories before publishing forks could leak internal agents; mitigated by release scripts or private submodules.

## Open Questions
1. What’s the minimal SaaS placeholder we should ship now to avoid confusion?
2. When should we invest in the in-app user provisioning UI versus continuing with manual scripts/console access?
3. How do we package/open-source the repo so internal `my-org`/`saas` agents never leak into customer forks?

## Appendix
- Current agent path: `apps/api/src/agents/actual` (to be renamed)
- Frontend landing view: `apps/web/src/views/LandingPage.vue`
- Related services: `apps/api/src/agent-factory.service.ts`, `ContextLoaderService`

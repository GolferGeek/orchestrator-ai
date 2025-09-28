# Agent-to-Agent Greenfield Analysis & Blueprint PRD

**Project Name:** Agent-to-Agent Greenfield Blueprint  
**Version:** 0.1 (Draft)  
**Date:** 2025-01-16  
**Author:** Matt Weber (via Codex assistant)

## 1. Objective

Perform a comprehensive audit of the current NestJS "agents" stack and produce a clean-room blueprint for the new agent-to-agent codebase. The deliverable is a complete, dependency-aware specification that captures required functionality, identifies waste, and defines the implementation approach for the greenfield module.

## 2. Scope

- Entire `apps/api/src/agents` tree (controllers, base services, agent implementations, sub-services).
- Supporting modules that influence agent execution: `llms` (centralized routing, PII), `tasks`, `deliverables`, `supabase`, `mcp`, `speech`, `usage`, `projects`.
- Data models/tables touched by the agent execution path (`agent_configurations`, `tasks`, `deliverables`, etc.).
- Runtime hooks (Nest modules, guards, pipes, interceptors) that interact with agent requests.

Out of scope: frontend, orchestrator UI, unrelated microservices.

## 3. Methodology

1. **Module Inventory**
   - Traverse every Nest module/provider in the agents ecosystem.
   - Record purpose, responsibilities, inbound/outbound dependencies, configuration flags, and runtime side effects.
2. **Behavior Classification**
   - Label each behavior as KEEP (core functionality), REPLACE (needs redesign), or DROP (dead/legacy/waste).
   - Capture reasons: business requirement, compliance, technical debt.
3. **Flow Mapping**
   - Document end-to-end request flows (JSON-RPC ingress, task lifecycle, deliverables, centralized routing, MCP integrations, WebSocket updates).
   - Note data persistence and cross-module communication.
4. **Risk & Debt Catalog**
   - Identify hard-coded values, fallbacks, TODO blocks, unused env flags, unguarded secrets, logging noise, untested branches.
   - Highlight dependencies that complicate future maintenance (e.g., Supabase coupling, file-based assumptions).
5. **Blueprint Authoring**
   - Define the target module layout for the new agent-to-agent codebase (controller layer, registry, execution gateway, policy services, storage adapters, DTOs/interfaces).
   - Specify contracts (TypeScript interfaces), request/response schemas, DI relationships, configuration points, migration requirements.
   - Ensure zero direct code reuse: any legacy behavior kept must be re-specified for reimplementation.

## 4. Deliverables

- **Comprehensive Inventory Report**: Markdown/diagrams summarizing each module/service with KEEP/REPLACE/DROP tags.
- **Flow Diagrams**: Sequence/activity diagrams for key execution paths.
- **Risk Log**: Ranked list of technical debt items with proposed resolutions.
- **Blueprint Specification**: Fully detailed spec for the greenfield agent-to-agent module (file structure, Nest modules/providers, DTOs, interfaces, tests, configuration).

## 5. Acceptance Criteria

- Every file in the legacy agents path has been reviewed and categorized.
- All current behaviors that must persist are documented with rationale.
- Areas of waste or debt are explicitly marked for removal, with impact assessed.
- Blueprint describes the new codebase end-to-end, ready for implementation planning and ticketing.
- Stakeholders agree the new plan requires no legacy code sharing and positions us to delete the old module once migrated.

## 6. Timeline (Draft)

1. **Week 1:** Module inventory & preliminary flow mapping.
2. **Week 2:** Deep-dive on routing/task/deliverable flows; debt catalog.
3. **Week 3:** Draft blueprint & diagrams; review with stakeholders.
4. **Week 4:** Finalize blueprint PRD, ready for implementation planning.

## 7. Open Questions

- Do we need to retain any debugging endpoints for engineering teams? If yes, design in blueprint.
- How far should the new blueprint plan for future features (e.g., multi-region, streaming enhancements)?
- Preferred documentation format for long-term maintenance (e.g., ADRs, architecture handbook)?

## 8. Next Steps

- Kick off inventory (create tracking spreadsheet/markdown).
- Schedule interim reviews with stakeholders to confirm KEEP vs REPLACE decisions.
- Begin drafting blueprint structure as discoveries are made.


# Orchestrator AI – Statement of Work (SOW)

## 1. Executive Summary
Orchestrator AI is an **agent platform** that empowers small-to-medium businesses to rapidly build, deploy, and evaluate AI agents with minimal engineering effort.  
Built on **NestJS** and TypeScript, the framework abstracts away low-level concerns (A2A protocol, logging, LLM orchestration, evaluation, etc.) so teams can focus on writing concise **LangGraph** logic (in TS or Python) and domain-specific context files.  
This SOW outlines completed work, in-flight tasks (≈ 75 % complete), and the remaining scope required to launch:

* **Hiverarchy AI** – a reference application that demonstrates hierarchical content generation agents.
* **LLM Flexibility & Constraints** – hot-swappable LLMs and cidafm-based runtime controls.
* **MCP Protocol Support** – reference servers (e.g., Supabase) and a TypeScript client library.
* **Evaluation Suite** – LangSmith integration plus automated multi-LLM benchmarking.
* **Marketing Site (orchestrator.ai)** – public landing page & educational materials.

_Originally conceived as an open teaching platform, Orchestrator AI has pivoted to a **closed-license, private-repository** product targeted at commercial deployments._

---

## 2. Objectives
1. Provide a production-ready agent framework that dramatically reduces time-to-value for SMEs.  
2. Enable seamless consumption of:
   * **Native agents** (written within the framework).
   * **API-backed agents** (wrapped via WebHooks or  n8n).  
   * **External A2A agents** (federated).
3. Offer granular runtime control over cost, accuracy, and privacy through easy LLM swapping and cidafm constraints.
4. Deliver built-in instrumentation for qualitative & quantitative agent evaluation.
5. Publish a polished marketing site with tutorials, demo videos, and a clear call-to-action.
6. Provide first-class **MCP protocol** support with example servers and a reusable client SDK.
7. Maintain the platform as **closed-source** IP; deployments for clients remain under proprietary license.

---

## 3. Scope of Work
### Phase 1 – Core Platform (✔ Completed)
| Feature | Details |
|---|---|
| **A2A Protocol** | Bi-directional JSON-RPC over HTTP; supports local & remote agents. |
| **Logging & Telemetry** | Centralized request / response logging with structured metadata. |
| **LLM Service** | Abstracts ChatOpenAI, Anthropic, Ollama, Google, etc. |
| **NestJS Plugin System** | Auto-discovers agents, registers routes, injects config. |
| **Context-Driven Agents** | Markdown context loading, YAML metadata, and agent cards. |

### Phase 2 – External-Service Agents (🟡 75 % Complete)
| Task | Status |
|---|---|
| **n8n / WebHook Wrapper** | Proof-of-concept functional; needs hardening + docs. |
| **Generic API Adapter** | Scaffold in place; extend DSL & validation. |
| **Federated A2A Agents** | Discovery & proxying implemented; UI exposure pending. |
| **MCP Protocol Support** | Supabase-backed server operational; client SDK scaffolding in progress. |

### Phase 3 – LLM Flexibility & cidafm Constraints (⬜ To Do)
* UI & CLI to select LLM per request.
* cidafm integration for on-demand constraints (token limits, chain-of-thought redaction, etc.).
* Persisted user presets & per-agent overrides.

### Phase 4 – Evaluation Framework (⬜ To Do)
* LangSmith already wired for run-level tracing.  
* Build evaluation harness to:
  1. Benchmark agents across multiple LLMs automatically.
  2. Collect user feedback & numerical scores.
  3. Surface leaderboards & regression alerts.

### Phase 5 – Reference Implementation: **Hiverarchy AI** (🟡 In Progress)
* Agents to **outline**, **draft**, **illustrate**, **edit**, and **publish** blog posts.  
* Autonomous "free-roam" agents constrained by:
  * Local LLM usage limits.
  * Restricted outbound calls (e.g., FireCrawl for current events scraping).
* Postgres integration for content persistence.

### Phase 6 – Marketing Site (**orchestrator.ai**) (⬜ To Do)
* Static site (+ optional serverless functions) showcasing:
  * Feature tour & architecture diagrams.
  * Demo videos (platform walkthrough, Hiverarchy AI in action).
  * Technical blog & changelog.
  * Contact / signup CTA.

---

## 4. Deliverables
1. **Core Framework v1.0** – delivered via private Git repository (closed commercial license).
2. **Agent SDK Docs** – markdown & inline JSDoc; code samples (access-limited).
3. **n8n / API Wrappers** – reusable modules + tutorials.
4. **LLM Selector & cidafm Controls** – CLI & REST endpoints.
5. **MCP Client SDK & Example Servers** – Supabase reference, mock server.
6. **Evaluation Dashboard** – web UI & JSON export.
7. **Hiverarchy AI MVP** – deployed demo instance.
8. **orchestrator.ai Website** – production domain with CDN.
9. **Video Assets** – 3 × feature demos, 2 × technical deep dives.

---

## 5. Timeline & Effort
| Phase | Est. Calendar Time | Effort (Person-Weeks) | Dependencies |
|---|---|---|---|
| Phase 2 Completion | 1 week | 2 PW | None |
| Phase 3 | 1 week | 2 PW | Phase 2 |
| Phase 4 | 1.5 weeks | 3 PW | Phases 2–3 |
| Phase 5 | 2 weeks (overlap) | 3 PW | Phase 3 partial |
| Phase 6 | 1 week | 1 PW | Phase 5 content |
| **Total Remaining** | **~4 weeks elapsed** | **11 PW** |  |

> _Note:_ Platform foundation comprises ≈ 30 PW already invested (not included above).

---

## 6. Roles & Responsibilities
| Role | Responsibility |
|---|---|
| **Product Owner** | Prioritize backlog, validate deliverables, approve scope changes. |
| **Tech Lead** | Architectural decisions, code review, CI/CD. |
| **Full-Stack Engineers (×2)** | Feature development & tests. |
| **DevRel / Content** | Tutorials, docs, videos. |
| **QA Engineer** | Automated & manual testing; evaluation harness. |

---

## 7. Acceptance Criteria
* All deliverables deployed to staging & passing automated test suites.
* Evaluation harness demonstrates agent performance comparison across ≥ 3 LLMs.
* Hiverarchy AI generates, edits, and publishes posts end-to-end with constrained resource usage.
* Marketing site live on **https://orchestrator.ai** with at least two embedded demo videos.
* Documentation covers installation, agent creation, wrapper creation, evaluation, and deployment.

---

## 8. Assumptions
* Access to required LLM APIs (OpenAI, Anthropic, etc.) and LangSmith.
* Stakeholder availability for weekly demos & feedback cycles.
* Content team provides video scripts & voice-over within timeline.

---

## 9. Risks & Mitigation
| Risk | Impact | Mitigation |
|---|---|---|
| API changes from LLM providers | High | Abstract via LLM Service; version pinning. |
| cidafm integration complexity | Med | Start with core constraints (token & CoT); iterative rollout. |
| Autonomous agent misuse (Hiverarchy) | Med | Enforce budget limits & outbound-call whitelists. |
| Scope creep for marketing site | Low | Freeze content requirements at design sign-off. |

---

## 10. Out-of-Scope Items
* Enterprise SSO, multi-tenant billing, or HIPAA compliance.
* Custom agent UIs beyond reference implementation.
* Automated infrastructure provisioning (e.g., Terraform modules).
* Development of educational curriculum or open-source course materials.

---

## 11. Sign-Off
| Name | Title | Date | Signature |
|---|---|---|---|
|  |  |  |  |

---
_Document version: **v0.9 (2025-06-26)** – pending stakeholder review._ 
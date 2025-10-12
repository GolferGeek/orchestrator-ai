# Orchestration Example Library

The orchestrations below ship with Phase 10 and demonstrate common workflow patterns. Definitions live under `docs/feature/matt/payloads/orchestrations/` and can be imported into Supabase via migration or the Admin console. Use these templates as starting points when designing new workflows.

| Orchestration | Purpose | Key Features | Definition |
| --- | --- | --- | --- |
| Marketing Campaign Launch | Coordinate multi-channel launch assets and executive summary. | Parallel asset generation, mandatory checkpoint, caching, retry metadata. | `marketing-campaign-launch.yaml` |
| Content Pipeline | Produce article outline → draft → compliance → distribution kit. | Conversation-per-step, checkpoint gating, QA review, caching. | `content-pipeline.yaml` |
| KPI Tracking | Query key metrics and summarize trends. | Supabase data fetch, deliverable mapping, optional checkpoint. | `kpi-tracking.yaml` |
| Finance Quarterly Review | Run KPI tracking as sub-orchestration and craft exec brief. | Child orchestration, aggregated results, finance-focused summary. | `finance-quarterly-review.yaml` |

---

## Marketing Campaign Launch
- **Definition:** `docs/feature/matt/payloads/orchestrations/marketing-campaign-launch.yaml`
- **Typical owner:** Orchestrator managing go-to-market programs.
- **Agents:** `marketing-swarm` (asset generation) and `summarizer` (executive summary).
- **Parameters:** `campaign_name`, `launch_date`, `primary_offer`, `target_audience`, optional `preferred_channels`.
- **Highlights:**
  - Parallelizes landing page copy and email sequence drafts once the campaign brief is approved.
  - Enforces a mandatory checkpoint after research gathering so stakeholders can request revisions.
  - Enables output caching for the research step (24h TTL) to avoid regenerating briefs for iterative asset tweaks.
- **Output Map:** Exposes landing page copy, email sequence, and GTM summary deliverables for downstream dashboards.

## Content Pipeline
- **Definition:** `docs/feature/matt/payloads/orchestrations/content-pipeline.yaml`
- **Typical owner:** Editorial team or content platform orchestrator.
- **Agents:** `blog_post_writer`, `hr_assistant`, `summarizer`.
- **Parameters:** `topic`, `audience`, `primary_keyword`, `tone`, `target_word_count`, `call_to_action`.
- **Highlights:**
  - Generates a reusable outline that is cached for 24 hours, allowing multiple drafts to iterate on the same structure.
  - Implements a required checkpoint before compliance review so editors can request revisions early.
  - Produces a distribution kit (executive summary + social/email assets) for marketing automation tooling.
- **Operator Tips:** QA results live in `steps.qa-review.qa_report`; treat flagged sections before marking the run complete.

## KPI Tracking
- **Definition:** `docs/feature/matt/payloads/orchestrations/kpi-tracking.yaml`
- **Agents:** `supabase-agent`, `summarizer`.
- **Use Case:** Finance teams pulling metric snapshots for ad-hoc reporting.
- **Key Features:**
  - Fetches KPI data via Supabase query and maps SQL output/deliverables into structured step outputs.
  - Optional checkpoint allows humans to validate SQL queries before summarisation.
  - Parameters (`kpi_names`, `start_date`, `end_date`, `grouping`) inject directly into query templates.
- **Pairings:** Often used as a child orchestration for finance review flows.

## Finance Quarterly Review
- **Definition:** `docs/feature/matt/payloads/orchestrations/finance-quarterly-review.yaml`
- **Agents:** Parent orchestrator delegates to `kpi-tracking` child run, then `summarizer` composes the executive brief.
- **Key Features:**
  - Demonstrates sub-orchestration support with parent/child metadata preserved in run history.
  - Aggregates child run results in the parent step output for downstream processing.
  - Ideal template for multi-orchestration rollups (e.g., monthly close, board packets).

---

### Using the Templates
1. Load the YAML into Supabase (`orchestration_definitions` table) or use the Admin API to upsert a definition.
2. Associate the definition with the owning orchestrator agent (e.g., `finance-manager`).
3. Launch via the orchestrator agent (`AgentExecutionGateway` mode `ORCHESTRATOR_RUN_START`) or through saved orchestration triggers.
4. Monitor runs using the dashboard (`GET /api/orchestrations`) and Prometheus metrics for duration + queue time insights.

Update this library whenever new orchestrations are introduced so operators have discoverable, documented recipes to reference.

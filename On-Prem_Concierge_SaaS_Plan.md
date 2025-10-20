---
title: Mid-Level On-Prem + Concierge SaaS Plan
date: 2025-10-19
tags: [strategy, architecture, on-prem, saas, partners, marketing, security]
---

### TL;DR
- **Strategy**: Offer two tracks — (1) on‑prem mid‑market “inside the firewall,” (2) concierge SaaS for smaller teams and handholding. Add a **partner program** for consultants.
- **Phasing**: Month 1 on a single Mac Studio; Months 2–3 graduate to 2–3 servers (API+Web, Postgres, GPU LLM), with hardened security and packaged vertical demos.
- **Outcome**: Credible deployments for small/medium orgs, partner‑friendly packaging, clear onboarding + multi‑org model.

---

### 1) Target Customers and Offers
- **On‑prem mid‑market (primary)**: 50–500 employees; privacy, firewall, regulated workflows, internal IT.
- **Concierge SaaS (secondary)**: 3–25 users; guided onboarding, “done‑with‑you” agent building; no mass multi‑tenant.
- **Partner enablement**: Consulting firms implement/customize; we provide reference architecture, training, and support tiers.

---

### 2) Reference Architecture (evolves with scale)
- **Core components**
  - Web/UI: Vue (Ionic) frontend
  - API: NestJS backend
  - DB: Postgres (+ pgvector), RLS on `org_id`
  - Object storage: S3/MinIO (replace cloud storage on-prem)
  - Vector DB (optional): Start with pgvector; later Qdrant if needed
  - LLM serving: Ollama or vLLM (local), model registry per org policy
  - Reverse proxy: Nginx/Caddy; TLS termination
  - Auth/SSO: OIDC/SAML (Okta/AAD/Keycloak)
  - Observability: Prometheus + Grafana (metrics), Loki (logs)
  - Secrets: Vault or SOPS (avoid .env in prod)
  - Backups: Nightly DB + object storage snapshots; test restores monthly
- **Packaging**
  - Month 1: Docker Compose (single host)
  - Month 2: Multi‑host Compose + Tailscale/WireGuard overlay
  - Month 3: K3s (lightweight Kubernetes) for HA customers

---

### 3) Security Baseline (inside the firewall)
- **Network**: Segmented VLANs; LLM box not internet‑exposed; egress‑blocked by default.
- **Data**: RLS by `org_id`; at‑rest encryption (Postgres, MinIO); field‑level encryption for PII as needed.
- **AuthN/Z**: OIDC SSO; per‑org roles; service accounts for agents; JWT short TTL.
- **Hardening**: CIS Docker/K8s benchmarks; minimal images; no outbound by default for LLM.
- **Audit**: Structured request/agent logs with redaction; immutable log sink.
- **Backups/DR**: 3‑2‑1 backups; restore runbooks; quarterly DR test.

---

### 4) Multi‑Org Model and Onboarding
- **Org structure**
  - `organizations` with unique slug; `users` linked via membership; roles: `owner`, `admin`, `builder`, `viewer`.
  - RLS and scoped API keys per org; separate object storage prefixes per org.
- **Onboarding flow**
  - Invite user -> create org (slug) -> seed sample context -> choose vertical template -> first agent scaffold.
  - Concierge SaaS: 60–90 minute kickoff; baseline “privacy relay” config; shared LLM or dedicated tenancy.
- **Data boundaries**
  - Default: single DB with RLS; on‑prem larger clients can choose dedicated DB/schema.

---

### 5) Vertical Demo Sites (pre‑built templates)
- **Law firm**
  - Use cases: intake triage, contract clause extraction, precedent retrieval.
  - Artifacts: sample matter files, clause library, role‑based approvals.
- **Financial org**
  - Use cases: policy Q&A, expense/compliance review, report drafting.
  - Artifacts: policy corpus, redaction rules, SOX‑friendly audit logs.
- **Manufacturing**
  - Use cases: SOP lookup, quality incident triage, vendor quote assist.
  - Artifacts: SOP library, equipment manuals, safety checklists.
- **Marketing**
  - Use cases: campaign planning, content briefs, rewrite with brand voice.
  - Artifacts: brand book, content calendar, approval workflows.

Each vertical ships with: org seed, sample assets, 2–3 ready agents, test data, and a one‑click demo script.

---

### 6) Hardware Sizing (phased)
- **Month 1 (dev / single‑user pilot)**
  - Mac Studio M2/M3, 32–64 GB RAM. Runs UI, API, DB, and small LLMs for demos.
- **Month 2 (small customer pilot, 10–30 users)**
  - API/Web: 8 vCPU, 32 GB RAM, 200 GB NVMe.
  - DB: 8 vCPU, 64 GB RAM, 2×1 TB NVMe (RAID1), WAL on separate volume.
  - LLM: 1× RTX 4090 (24 GB VRAM) or L40S (24–48 GB), 16 vCPU, 128 GB RAM, 2 TB NVMe.
- **Month 3+ (medium, 30–100 users / heavier models)**
  - DB: 16 vCPU, 128 GB RAM, 4×2 TB NVMe (RAID10).
  - LLM: 2× 4090 or a single 80 GB class (A100/A800/L40S 48 GB with offload), 256 GB RAM host.
  - Optional: separate Vector DB node; HA proxy pair.

Notes: 7B–13B models fit well on 24 GB VRAM; 70B requires tensor parallel or 80 GB class. Start with 7B/13B for on‑prem latency and privacy.

---

### 7) Deployment Milestones
- **0–2 weeks**
  - Package Compose single‑node; env templates; seed data + vertical templates.
  - Wire OIDC login; RLS checks; object storage (MinIO); nightly backups.
- **3–6 weeks**
  - Split into API/Web, DB, LLM servers; add metrics/logging; harden images.
  - Deliver 4 vertical demos; partner enablement deck + installer guide.
- **7–8 weeks**
  - K3s option; zero‑trust overlay (Tailscale/WireGuard); signed releases.
  - Pilot with one on‑prem customer, one concierge SaaS team.

---

### 8) Marketing and GTM
- **Positioning**: “Private AI Orchestration inside your firewall. Agents with policy, audit, and handholding.”
- **Assets**: Vertical landing pages, 2‑min demos per vertical, security brief, on‑prem checklist.
- **Channels**: LinkedIn posts 2×/week, founder threads on X, 1–2 partner webinars/month.
- **Proof**: Case‑study style demos with measurable outcomes (time saved, error reduction).

---

### 9) Partner Program (consulting firms)
- Tiers: Registered, Certified, Premier.
- Benefits: NFR license, training, priority support, lead sharing.
- Requirements: Certified: 2 case demos + security review pass.

---

### 10) Pricing Hints (to validate)
- **On‑prem license**: annual + support; per‑server or per‑seat (whichever fits buyer).
- **Concierge SaaS**: per‑seat + setup fee; optional dedicated LLM box.
- **Professional services**: agent building packages per vertical.

---

### 11) Immediate Next Steps
- Finalize single‑node Compose with MinIO + pgvector + Ollama.
- Build 4 vertical seeds (content + 2 agents each).
- Ship OIDC + role model + org slug UI flow.
- Produce 4 short demo videos (≤2 min) and vertical pages.
- Prep partner one‑pager + install guide (on‑prem).



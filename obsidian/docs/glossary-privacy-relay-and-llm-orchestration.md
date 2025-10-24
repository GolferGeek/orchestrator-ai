### Glossary: Privacy Relay and LLM Orchestration (Single-Deployment)

Use this to quickly understand terms used in the PRDs and phase docs. Grouped by concept with short definitions and why they matter.

---

#### Core deployment model
- Single‑deployment (per company): We install the whole system in your environment. Policies, keys, logs, and caches belong to your company only.
- Agent: A focused capability (e.g., Metrics/KPI). Agents call the centralized LLM service; they do not talk to providers directly.
- LLM service (centralized): The only place that talks to external or local models. It enforces privacy, routing, and logging.

#### Privacy relay concepts
- Classification (PUBLIC/INTERNAL/CONFIDENTIAL): A quick label for how sensitive the input is. Drives how aggressive redaction must be.
- Redaction: Removing or masking sensitive text (e.g., emails, account IDs). Irreversible.
- Pseudonymization (deterministic): Replacing sensitive items with tokens (e.g., <EMAIL#A1>). Reversible by us later using a key.
- BYOK (Bring Your Own Key): You control the encryption/key material used to create/restore pseudonyms. Keys can live in your KMS.
- Pseudonym map: A secure mapping of token → original value (or a handle in your vault). Stored under your control; used to de‑tokenize when allowed.
- Output redaction: Applying redaction rules to model outputs to avoid leaking sensitive info in responses/logs.
- Source blinding: Ensuring outbound provider calls do not include identifying headers, referrers, or network details about your environment. One scrubbed egress path.

#### Routing and providers
- Provider adapter: A small module that speaks a specific provider’s API (OpenAI, Anthropic, Azure, local). All use the same internal interface.
- Routing policy: Rules that pick which provider to use based on cost, latency, task type, or safety profile.
- Fallback chain: A predefined order of secondary providers to try when the first one fails or violates a policy.
- Caching/memoization: Reusing prior results for identical requests to cut cost and latency (with safe expiry windows).
- No‑train/No‑retain: Provider options/agreements to prevent training on, or retaining, your data. Defense‑in‑depth, not a substitute for redaction.

#### Sovereignty
- Sovereign mode: A hard switch that forbids any external LLM calls. Only local/private inference is allowed.
- Residency: Keeping processing in a specific region (e.g., US‑only). The router enforces regional constraints.

#### Observability and control
- Run ledger: A structured log per model call: policy used, provider, costs, latency, cache/fallback events, and safety flags. Hash‑chained for integrity.
- Canary/shadow run: Testing a new model/policy on a small slice of traffic to measure impact before full rollout.
- Rollback: Automatically reverting to a safe prior configuration if canary/eval scores regress.
- Budgets/alerts: Limits and notifications for spend or error rates; router can move to cheaper models when safe.

#### CID AFM (in‑model guidance)
- CID AFM preset: A prewritten set of instructions added to the model’s system prompt to encourage privacy‑respecting behavior (e.g., “don’t reconstruct masked entities”). It complements, but does not replace, hard privacy rules outside the model.

#### Headers and metadata (SDK‑set)
- X‑Policy‑Profile: Which policy profile to apply (e.g., standard, balanced_privacy, strict_privacy, sovereign).
- X‑Data‑Class: Sensitivity label (PUBLIC/INTERNAL/CONFIDENTIAL) for the current request.
- X‑Sovereign‑Mode: Boolean toggle to force local‑only inference.
- x‑run‑id / x‑provider / x‑latency / x‑cost / x‑cache‑hit: Response metadata for demos, debugging, and audits (non‑PII).

#### Overarching mental models
- Privacy relay: Hard safety outside the model (classify → redact/pseudonymize → source‑blind route → optional detokenize).
- Vendor‑agnostic orchestration: Treat models like interchangeable compute; differentiate with policy, routing, and proofs.
- Defense‑in‑depth: Combine redaction, pseudonymization, source blinding, no‑train/no‑retain, and output filtering rather than relying on any single control.

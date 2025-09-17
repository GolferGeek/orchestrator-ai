### Shared Relay Mode (Consortium) — Future Note

Purpose: optional post‑MVP pattern for a consortium of small companies (“Davids”) to share an upstream LLM provider account through a privacy relay, without exposing member identities to the provider.

Key ideas
- One upstream provider key owned by the relay (or multiple subaccounts if needed for quotas/contracts).
- Each company authenticates to the relay with an opaque org token (JWT/mTLS). The token selects its policy profile.
- The relay classifies → redacts/pseudonymizes → source‑blinds → routes using the relay key. No org identifiers leave the relay.
- Per‑org isolation for storage, caches, pseudonym maps, budgets, and logs. The provider only sees the relay.

Provider visibility
- Provider sees: relay account/key, egress IP, request payload (already redacted/pseudonymized).
- Provider does not see: member org identity, headers, or network fingerprints of members.

Considerations
- Terms/billing: verify that shared usage complies with provider ToS; consider per‑org subaccounts if required.
- Security: rotate keys; per‑org rate limits; audit logs in the relay; incident playbooks.
- Governance: optional third‑party attestation of relay policies if members need assurance.

Demo (later)
- Use the Metrics agent with three org tokens bound to different policy profiles (standard, strict_privacy, sovereign). Show scrubbed headers and single upstream account in logs.



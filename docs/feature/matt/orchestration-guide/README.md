# Orchestration Guide

Central documentation hub for the orchestration system (Phase 10 deliverable). The files below replace scattered notes from earlier phases and should be treated as the source of truth.

- [Architecture Overview](./architecture.md)
- [API Reference](./api-reference.md)
- [Definition Authoring Guide](./definition-guide.md)
- [Best Practices](./best-practices.md)
- [Troubleshooting Playbook](./troubleshooting.md)
- [Example Library](./examples.md)
- [Production Readiness Checklist](../production-readiness-checklist.md)

**Who should read what**
- Backend engineers → architecture + API reference
- Product/frontend engineers → API reference + examples
- Operators / on-call → troubleshooting + best practices
- Agent authors → definition guide + examples

**Contributing**
1. Update the relevant markdown file whenever behaviour changes.
2. Link new orchestration examples in `examples.md` and store YAML under `docs/feature/matt/payloads/orchestrations/`.
3. Coordinate with Claude so corresponding tests and verifications stay aligned.

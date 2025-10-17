# Phase 2 Inventory — LLM & Evaluation Modules

Generated: 2025-10-17T22:12:09Z

## Rule Totals (src/llms/**/*)

| Rule | Hits |
| --- | ---: |
| @typescript-eslint/no-unsafe-member-access | 907 |
| @typescript-eslint/no-unsafe-assignment | 639 |
| @typescript-eslint/no-explicit-any | 365 |
| @typescript-eslint/no-unsafe-argument | 140 |
| @typescript-eslint/no-unused-vars | 106 |
| @typescript-eslint/no-unsafe-call | 70 |
| @typescript-eslint/no-unsafe-return | 70 |
| @typescript-eslint/require-await | 28 |
| no-useless-escape | 15 |
| no-case-declarations | 7 |
| prettier/prettier | 5 |
| no-empty | 3 |
| @typescript-eslint/no-unsafe-enum-comparison | 2 |
| @typescript-eslint/no-base-to-string | 1 |

## Top Offending Files

| File | Total | no-explicit-any | no-unsafe-assignment | no-unsafe-member-access |
| --- | ---: | ---: | ---: | ---: |
| src/llms/evaluation/evaluation.service.ts | 771 | 50 | 176 | 413 |
| src/llms/llm.service.ts | 214 | 45 | 76 | 66 |
| src/llms/usage/usage.service.ts | 147 | 30 | 31 | 70 |
| src/llms/services/llm-error-handling.ts | 119 | 19 | 49 | 39 |
| src/llms/services/base-llm.service.ts | 95 | 14 | 27 | 38 |
| src/llms/centralized-routing.service.ts | 76 | 7 | 30 | 29 |
| src/llms/run-metadata.service.ts | 74 | 6 | 22 | 42 |
| src/llms/services/google-llm.service.ts | 67 | 7 | 22 | 26 |
| src/llms/services/grok-llm.service.ts | 60 | 2 | 24 | 23 |
| src/llms/evaluation/evaluation.controller.ts | 57 | 24 | 3 | 12 |
| src/llms/cidafm/cidafm.service.ts | 40 | 5 | 13 | 6 |
| src/llms/services/ollama-llm.service.ts | 38 | 5 | 6 | 13 |
| src/llms/blinded-llm.service.ts | 37 | 11 | 6 | 10 |
| src/llms/local-llm.service.ts | 32 | 2 | 9 | 10 |
| src/llms/pii/dictionary-pseudonymizer.service.ts | 31 | 7 | 8 | 13 |

## Notes
- Evaluation service alone accounts for ~50% of unsafe member access hits.
- llm.service.ts and usage.service.ts are the next largest clusters; both rely on dynamic metadata objects.
- DTO coverage gaps: evaluation results, routing decisions, usage logging payloads, error envelopes.
- Schema/validation gaps: provider responses (OpenAI, Anthropic, Google) and centralized routing decision payloads currently pass through as raw objects.

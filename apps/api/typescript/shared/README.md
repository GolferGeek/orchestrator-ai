# TypeScript - Shared Utilities

This directory is intended for TypeScript utility functions, helper classes, or shared business logic that might be used by **multiple TypeScript-based API implementations** within this monorepo (e.g., `nestjs-v2`, or other future TypeScript services).

## Purpose

- **Reduce Code Duplication:** Consolidate common TypeScript code that isn't specific to a single API version or framework implementation.
- **Promote Consistency:** Ensure common tasks are handled in a standardized way across different TypeScript services.

## Examples of Content

- Custom authentication/authorization helpers (e.g., NestJS guards or strategies if broadly applicable).
- Common data transformation functions or decorators.
- Shared interfaces or types (if not part of a generated contract).
- Logging configurations or helpers.

**Note:** If a utility is strictly tied to the A2A v2 protocol and its contracts, consider if it belongs in `../../shared/v2/` or as part of the generated code from those contracts. 
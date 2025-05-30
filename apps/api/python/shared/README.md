# Python - Shared Utilities

This directory is intended for Python utility functions, helper classes, or shared business logic that might be used by **multiple Python-based API implementations** within this monorepo (e.g., `fastapi-v1`, `fastapi-v2`, or other Python services).

## Purpose

- **Reduce Code Duplication:** Consolidate common Python code that isn't specific to a single API version or framework implementation.
- **Promote Consistency:** Ensure common tasks are handled in a standardized way across different Python services.

## Examples of Content

- Custom authentication/authorization helpers.
- Database interaction utilities (if not framework-specific).
- Common data transformation functions.
- Shared Pydantic base models or utility types (if not part of a generated contract).
- Logging configurations or helpers.

**Note:** If a utility is strictly tied to the A2A v2 protocol and its contracts, consider if it belongs in `../../shared/v2/` or as part of the generated code from those contracts. 
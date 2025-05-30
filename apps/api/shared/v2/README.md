# Shared API v2 Components

This directory contains shared components and configurations for **Version 2 (v2)** of the API. These components are designed to be used by both the Python (FastAPI v2) and TypeScript (NestJS v2) API implementations.

## Subdirectories

- `contracts/`: OpenAPI v3 contract definitions (YAML files) for A2A v2 protocol, agent types, and common types. These define the data structures and communication protocols.
- `generated/`: Code generated from the OpenAPI contracts.
  - `python/`: Generated Python client libraries and/or Pydantic models.
  - `typescript/`: Generated TypeScript client libraries and/or interfaces.
- `docs/`: Shared documentation related to the v2 API, its architecture, or usage guidelines for the shared components.

## Purpose

The primary goal of this shared directory is to ensure consistency and reduce duplication between different backend implementations of the v2 API. By defining contracts and generating code from a single source of truth, we can maintain a coherent API surface across different technology stacks. 
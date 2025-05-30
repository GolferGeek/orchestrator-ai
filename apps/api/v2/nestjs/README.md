# TypeScript - NestJS v2 Implementation

This directory contains the source code for the **Version 2 (v2)** API, implemented using TypeScript and the NestJS framework.

## Key Characteristics

- **Shared Contracts:** This v2 implementation **uses the shared OpenAPI contracts** defined in `../../shared/v2/contracts/`.
- **Generated Code:** It should leverage the generated TypeScript interfaces/clients from `../../shared/v2/generated/typescript/` for type safety and consistency.
- **Modern Implementation:** This is a new implementation starting directly with v2 of the API, built on NestJS for a robust and scalable architecture.

## Structure

Typical NestJS project structure might include:
- `src/`
  - `modules/`: Feature modules (e.g., agent modules, task management modules).
  - `core/` or `common/`: Core services, guards, interceptors, pipes.
  - `config/`: Application configuration.
  - `main.ts`: Application entry point.
- `test/`: Unit and e2e tests.
- `package.json`: Node.js dependencies.
- `tsconfig.json`: TypeScript configuration.

This implementation should align closely with the A2A v2 protocol defined in the shared contracts. 
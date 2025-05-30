# Python - FastAPI v2 Implementation

This directory contains the source code for the **Version 2 (v2)** API, implemented using Python and FastAPI.

## Key Characteristics

- **Shared Contracts:** This v2 implementation **uses the shared OpenAPI contracts** defined in `../../shared/v2/contracts/`.
- **Generated Code:** It should leverage the generated Python models/clients from `../../shared/v2/generated/python/` for type safety and consistency.
- **Modern Implementation:** Represents the next generation of the API, potentially introducing new features, architectural improvements, and best practices.

## Structure

Typical structure might include:
- `agents/` or `services/`: Business logic for different agents or services.
- `core/`: Core application settings, configurations.
- `routes/`: FastAPI route definitions, using models from the shared generated code.
- `main.py`: FastAPI application entry point.
- `requirements.txt`: Python dependencies.

This implementation should align closely with the A2A v2 protocol defined in the shared contracts. 
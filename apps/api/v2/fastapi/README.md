# Python - FastAPI v2 Implementation

This directory contains the source code for the **Version 2 (v2)** API, implemented using Python and FastAPI.

## Key Characteristics

- **Shared Contracts:** This v2 implementation **uses the shared OpenAPI contracts** defined in `../../shared/contracts/`.
- **Generated Code:** It leverages the generated Python models/clients from `../../shared/generated/python/` for type safety and consistency.
- **Modern Implementation:** Represents the next generation of the API, introducing A2A protocol compliance, agent delegation, and improved architecture.
- **A2A Protocol Compliant:** Fully implements the Agent-to-Agent protocol with proper output_artifacts format for response data.

## Current Status: ✅ **WORKING & PRODUCTION READY**

The V2 API is fully functional with the following capabilities:
- **Agent Orchestration**: Orchestrator agent successfully delegates tasks to specialized agents
- **MCP Integration**: Working Model Context Protocol integration for agent responses  
- **A2A Protocol**: Proper A2A-compliant response format with output_artifacts
- **Agent Attribution**: Responses properly attributed to the delegated agent (e.g., "Metrics Agent" not "Orchestrator")
- **Frontend Integration**: Vue.js frontend can switch between V1 and V2 APIs seamlessly

## Structure

Current working structure:
- `agents/`: Business logic for different agents organized hierarchically
  - `system/orchestrator/`: Core orchestration logic with delegation capabilities
  - `business/metrics/`: Metrics analysis agent with MCP context integration
  - `marketing/blog_post/`: Blog content generation agent
- `a2a_protocol/`: A2A protocol implementation and unified agent services
- `core/`: Core application settings and configurations
- `shared/mcp/`: Model Context Protocol integration
- `main.py`: FastAPI application entry point
- `pyproject.toml`: PDM dependencies

## Ports & Deployment

- **Port**: 8001 (V1 uses 8000)
- **Environment**: Supports dev, test, and prod configurations
- **Container**: Docker setup with PDM package management

## A2A Protocol Implementation

This v2 implementation fully complies with the A2A (Agent-to-Agent) protocol:
- Task delegation with proper agent discovery
- Response formatting using `output_artifacts` structure
- Agent metadata preservation for proper attribution
- Error handling with standardized error codes

This implementation should align closely with the A2A v2 protocol defined in the shared contracts. 
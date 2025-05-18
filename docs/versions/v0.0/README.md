# Orchestrator AI v0.0

This is the initial release of the Orchestrator AI system, implementing the context-based agent bootstrapping phase. This version establishes the foundation for a multi-agent system where each agent leverages markdown files as knowledge bases.

## 🌟 Features

### Core Framework
- **Shared MCP (Message Control Program)**: A central system that loads markdown-based context for any agent
- **Dynamic Agent Discovery**: The orchestrator can automatically discover and route to all available agents
- **LLM-Based Routing**: Uses OpenAI's models to intelligently route user queries to the appropriate agent

### Agents
- **Orchestrator Agent**: Central routing agent that analyzes user queries and delegates to specialized agents
- **Metrics Agent**: Provides business metrics information using a markdown-based knowledge base
- **Blog Post Writer**: Creates high-quality blog posts based on user prompts
- Several other bootstrapped agents in various domains (HR, marketing, development, etc.)

### Architecture
- **FastAPI Backend**: All agents expose standardized REST endpoints
- **A2A Protocol**: Agents communicate using a consistent protocol
- **Markdown Context**: Knowledge is stored in structured markdown files (`markdown_context/`)

## 🔍 Technical Details

### Context System
The system uses markdown files as knowledge bases located in the `markdown_context/` directory at the project root. Each agent has its own markdown file (e.g., `metrics_agent.md`) containing:

- Agent persona/role definition
- Key information and data
- Capabilities and limitations
- Example interactions
- Structured data in appropriate markdown format

### MCP (Message Control Program)
The shared MCP handles:
- Loading context from markdown files
- Constructing prompts with context
- Calling OpenAI's API
- Returning formatted responses

### Agent Discovery
The orchestrator dynamically discovers all available agents by:
1. Scanning the agent directory structure
2. Reading agent metadata from `.well-known/agent.json` or agent cards
3. Building a comprehensive list of all available agents and their capabilities
4. Using this list when making LLM-based routing decisions

## 🚀 Future Roadmap
This v0.0 release establishes the foundation. Future versions will focus on:

- Enhanced agent capabilities
- More complex agent interactions
- Integration with vector databases for larger knowledge bases
- Web UI for easier interaction
- More sophisticated orchestration patterns

## 📚 Documentation
- [Main README](../../../README.md): Setup and usage instructions
- [Architecture](./architecture.md): System architecture and components
- [Git Workflow](./git-workflow.md): Guide for collaborating with branches and pull requests 
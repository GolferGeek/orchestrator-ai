---
description: "Guidelines for directory organization, package management, and dependencies in our A2A agent framework"
globs: ["**/*.json", "**/*.md", "**/*/"]
alwaysApply: true
---
name: "Mono-Repo Structure"
description: "Guidelines for directory organization, package management, and dependencies in our A2A agent framework"
globs: ["**/*.json", "**/*.md", "**/*/"]
alwaysApply: true
# Mono-Repo Structure Guidelines

## Directory Structure

- The project is organized as a monorepo using Turborepo
- APIs are organized by technology stack and version under `apps/api/`
- Shared code lives in `shared/` directory
- All agents must expose a `.well-known/agent.json` file for A2A compatibility

## Agent Structure
- Each agent follows this basic structure:
  ```
  apps/api/[tech-stack]/[version]/agents/[agent_name]/
  ├── .well-known/
  │   └── agent.json     # A2A-compatible agent definition
  ├── routes.py          # FastAPI routes for the agent (Python)
  ├── routes.ts          # NestJS routes for the agent (TypeScript)
  └── README.md          # Agent documentation
  ```

## Markdown Context Structure
- Agent knowledge bases are stored within their respective API implementation directories
- Each agent has a corresponding markdown file: `[agent_name].md` (e.g., `metrics_agent.md`) within its context directory
- No context file should exceed 1MB in size

## Package Management
- Use pnpm for Node.js package management
- Use pip and requirements.txt for Python dependencies
- Dependencies should be scoped to relevant workspaces

## Importing Guidelines
- Prefer relative imports within the same agent
- Use absolute imports for shared code
- Always import shared utilities from their public exports

## Commit Guidelines
- Use conventional commit messages
- Reference related issues when applicable
- Keep commits focused on a single agent or feature

## Configuration
- Environment variables in `.env` files (never committed)
- Agent-specific configuration in their respective directories
- Shared configuration in `shared/config/`

## Version Management
- Multiple technology stacks can coexist under `apps/api/`
- Each implementation maintains its own versioning strategy
- Breaking changes should be implemented in new versions while maintaining backward compatibility


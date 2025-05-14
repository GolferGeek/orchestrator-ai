#!/usr/bin/env python3
"""
Script to create Cursor MDC rule files with proper YAML front matter
"""
import os
import sys
from pathlib import Path

def create_mdc_file(filename, name, description, globs=None, always_apply=False, content=""):
    """Create an MDC file with proper front matter"""
    if globs is None:
        globs = []
    
    # Ensure .cursor/rules directory exists
    rules_dir = Path(".cursor/rules")
    rules_dir.mkdir(parents=True, exist_ok=True)
    
    # Create the file path
    file_path = rules_dir / filename
    
    # Format globs as YAML list
    globs_yaml = f"[{', '.join(f'"{g}"' for g in globs)}]" if globs else "[]"
    
    # Create the front matter and content
    with open(file_path, "w") as f:
        f.write("---\n")
        f.write(f'name: "{name}"\n')
        f.write(f'description: "{description}"\n')
        f.write(f"globs: {globs_yaml}\n")
        f.write(f"alwaysApply: {str(always_apply).lower()}\n")
        f.write("---\n\n")
        f.write(content)
    
    print(f"Created {file_path}")

if __name__ == "__main__":
    # Create mono-repo structure rule
    mono_repo_content = """# Mono-Repo Structure Guidelines

## Directory Structure

- The project is organized as a monorepo using Turborepo
- Each agent has its own directory under `apps/api/agents/`
- Shared code lives in `shared/` directory
- All agents must expose a `.well-known/agent.json` file for A2A compatibility

## Agent Structure
- Each agent follows this basic structure:
  ```
  apps/api/agents/[agent_name]/
  ├── .well-known/
  │   └── agent.json     # A2A-compatible agent definition
  ├── routes.py          # FastAPI routes for the agent
  └── README.md          # Agent documentation
  ```

## Markdown Context Structure
- Agent knowledge bases are stored in `markdown_context/` at project root
- Each agent has a corresponding markdown file: `markdown_context/[agent_name].md`
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
"""
    
    create_mdc_file(
        "001-mono-repo-structure.mdc",
        "Mono-Repo Structure",
        "Guidelines for directory organization, package management, and dependencies in our A2A agent framework",
        globs=["**/*.json", "**/*.md", "**/*/"],
        always_apply=True,
        content=mono_repo_content
    )

    # Create Python API standards rule
    python_api_content = """# Python API Standards

## General Principles
- Follow PEP 8 for code style.
- Write clear, concise, and maintainable code.
- Embrace asynchronous programming (`async`/`await`) for I/O-bound operations.
- Use type hints for all function signatures and variables.

## FastAPI Best Practices
- Use Pydantic models for request and response validation.
- Leverage FastAPI's dependency injection system for managing resources and dependencies.
- Organize routes logically, typically by resource or functionality.
- Use `APIRouter` to group related routes and include them in the main `FastAPI` app.
- Implement proper status codes for HTTP responses (e.g., 200, 201, 400, 404, 500).
- Use `HTTPException` for standard HTTP errors.

## Route Organization
- Group related endpoints in separate Python modules (e.g., `apps/api/agents/[agent_name]/routes.py`).
- Use descriptive names for route functions.
- Keep route functions focused on handling the request and returning a response; delegate business logic to service layers or utility functions.

## Error Handling
- Implement centralized error handling using exception handlers or middleware where appropriate.
- Provide meaningful error messages to clients without exposing sensitive internal details.
- Log errors with sufficient context for debugging.

## Pydantic Model Usage
- Define Pydantic models for all request bodies, query parameters, and response payloads.
- Use field validators for complex validation logic.
- Utilize response_model to serialize and validate outgoing data.

## Asynchronous Programming
- Use `async def` for all route handlers and I/O-bound operations.
- Use `await` for calling asynchronous functions.
- Be mindful of blocking calls within async functions; use `run_in_threadpool` if necessary for synchronous libraries.

## Dependency Injection
- Use FastAPI's `Depends` for injecting dependencies like database sessions, configuration, or service classes.
- Define dependencies as callable functions or classes.

## Logging
- Use the standard `logging` module.
- Configure logging levels appropriately for different environments (DEBUG in dev, INFO/WARNING in prod).
- Include relevant information in log messages, such as request IDs, timestamps, and context-specific data.

## Testing
- Write unit tests for business logic and utility functions.
- Write integration tests for API endpoints using FastAPI's `TestClient`.
- Aim for high test coverage.
- Use fixtures for setting up test data and dependencies.
"""
    create_mdc_file(
        "002-python-api-standards.mdc",
        "Python API Standards",
        "Guidelines for Python backend development using FastAPI, Pydantic, and asynchronous programming.",
        globs=["apps/api/**/*.py", "shared/**/*.py"],
        always_apply=True,
        content=python_api_content
    )

    # Create Vue Frontend guidelines rule
    vue_frontend_content = """# Vue Frontend Guidelines

## General Principles
- Follow the official Vue.js style guide.
- Write modular, reusable, and maintainable components.
- Prioritize performance and user experience.

## Component Structure
- Use Single File Components (.vue files).
- Organize components into logical directories (e.g., `components/common`, `components/featureX`).
- Keep components small and focused on a single responsibility.
- Use PascalCase or kebab-case for component names, be consistent.

## State Management
- For simple state, use Vue's built-in reactivity system (`ref`, `reactive`).
- For complex global state, use Pinia.
- Organize Pinia stores by feature or domain.
- Avoid direct manipulation of state outside of store actions/mutations.

## UI/UX Patterns
- Strive for a clean, intuitive, and modern user interface.
- Ensure responsiveness across different screen sizes.
- Provide clear feedback to users for actions and loading states.
- Adhere to accessibility best practices (WCAG).

## Asset Organization
- Store static assets (images, fonts) in the `public/` directory or `src/assets/` as appropriate.
- Optimize images for web use.

## Routing
- Use Vue Router for client-side navigation.
- Define routes clearly, potentially in a dedicated `router.js` or `router/index.js` file.
- Use named routes and route parameters where applicable.
- Implement route guards for authentication and authorization.

## API Integration
- Use a dedicated service or utility for API calls (e.g., using `axios` or `fetch`).
- Handle API errors gracefully and provide user feedback.
- Manage loading states effectively.

## Styling
- Prefer scoped CSS within components to avoid style conflicts.
- Consider using a CSS framework (like Tailwind CSS) or preprocessor (like SCSS) consistently.
- Define a consistent design system (colors, typography, spacing).

## Testing
- Write unit tests for components and utility functions using Vitest or Jest.
- Consider end-to-end testing with tools like Cypress or Playwright for critical user flows.
"""
    create_mdc_file(
        "003-vue-frontend-guidelines.mdc",
        "Vue Frontend Guidelines",
        "Best practices for developing the Vue.js frontend application.",
        globs=["apps/web/**/*.vue", "apps/web/**/*.js", "apps/web/**/*.ts"],
        always_apply=True,
        content=vue_frontend_content
    )

    # Create Markdown Context standards rule
    markdown_context_content = """# Markdown Context Standards

## Purpose
- Markdown context files serve as the primary knowledge base for agents in the early bootstrapping phase.
- They allow for rapid prototyping and iteration before implementing more complex RAG or API integrations.

## File Location
- All agent context files must be located in the `markdown_context/` directory at the project root.
- Each agent should have its own markdown file named `[agent_name].md` (e.g., `metrics_agent.md`).

## Formatting Requirements
- Use standard Markdown syntax.
- Organize content logically using headings (H1, H2, H3, etc.) for structure.
- Use clear and concise language.

## Content Guidelines
- **Agent Persona/Role**: Define the agent's role, expertise, and tone.
- **Key Information**: Include core data, facts, or knowledge relevant to the agent's function.
  - For `metrics_agent`: Sample metrics, definitions, calculation methods, interpretation guidelines.
  - For `write_blog_post`: Blog post structures, style guides, SEO keywords, example opening/closing paragraphs.
- **Capabilities & Limitations**: Clearly state what the agent can and cannot do based on the provided context.
- **Example Interactions**: Provide a few examples of user queries and expected agent responses based *only* on the markdown content. This helps in understanding the agent's intended behavior.
- **Data Formatting**: For structured data (like tables or lists of items), use Markdown tables or formatted lists for easy parsing by an LLM.

## Size Limitations
- No single context file should exceed 1MB. This is a practical limit to ensure efficient processing by LLMs and to encourage focused, relevant context.

## Maintenance
- Regularly review and update context files as the project evolves.
- Ensure consistency between the agent's `agent.json` description and its markdown context capabilities.
"""
    create_mdc_file(
        "004-markdown-context-standards.mdc",
        "Markdown Context Standards",
        "Guidelines for creating and maintaining agent knowledge bases using Markdown files.",
        globs=["markdown_context/**/*.md"],
        always_apply=True,
        content=markdown_context_content
    )

    # Create Testing standards rule
    testing_standards_content = """# Testing Standards

## General Principles
- Write tests for all new features and bug fixes.
- Tests should be reliable, readable, and maintainable.
- Aim for a balanced testing pyramid (unit, integration, E2E).
- Ensure tests can run independently and in any order.

## Unit Tests
- Focus on testing individual functions, methods, or components in isolation.
- Mock external dependencies to avoid side effects and ensure test speed.
- Use clear and descriptive test names.
- Each test should verify a single piece of behavior.
- **Python**: Use `pytest` as the primary testing framework. Store tests in the `tests/unit` directory or alongside the code they test (e.g., `tests/apps/api/agents/test_agent_routes.py`).
- **Vue**: Use Vitest or Jest for component and utility function unit tests. Store tests in `__tests__` directories or alongside the component files (e.g., `src/components/__tests__/MyComponent.spec.js`).

## Integration Tests
- Test the interaction between multiple components or modules.
- For FastAPI, use `TestClient` to test API endpoints, including request/response validation and interaction with services.
- Store Python integration tests in `tests/integration`.
- Minimize mocking; use real dependencies where feasible (e.g., a test database).

## End-to-End (E2E) Tests
- Test complete user flows through the application.
- Use tools like Cypress or Playwright for frontend E2E testing.
- E2E tests are typically slower and more brittle, so focus on critical paths.

## Test Organization
- Maintain a clear directory structure for tests (e.g., `tests/unit`, `tests/integration`).
- Use descriptive file names for test files (e.g., `test_user_service.py`, `LoginFlow.e2e.js`).

## Code Coverage
- Strive for high code coverage, but prioritize quality of tests over quantity.
- Use coverage tools to identify untested code paths.

## Continuous Integration (CI)
- Integrate tests into the CI pipeline to run automatically on every push/PR.
- Ensure builds fail if tests do not pass.
"""
    create_mdc_file(
        "005-testing-standards.mdc",
        "Testing Standards",
        "Guidelines for writing unit, integration, and end-to-end tests for both backend and frontend.",
        globs=["tests/**/*.py", "apps/web/**/__tests__/*.spec.js"],
        always_apply=True,
        content=testing_standards_content
    )

    # Create Environment Configuration rule
    environment_config_content = """# Environment Configuration

## General Principles
- Maintain separate configurations for different environments (e.g., `dev`, `test`, `prod`).
- Never commit sensitive information (API keys, passwords, secrets) directly into the codebase.

## .env Files
- Use `.env` files for environment-specific variables.
- Each environment should have its own `.env` file (e.g., `.env.development`, `.env.production`).
- A `.env.example` file should be committed to the repository, listing all required environment variables with placeholder or default values.
- `.env` files (except `.env.example`) must be listed in `.gitignore`.

## Loading Environment Variables
- **Python/FastAPI**: Use Pydantic's `Settings` management or libraries like `python-dotenv` to load variables from `.env` files.
- **Vue/Node.js**: Utilize tools like `dotenv` or framework-specific mechanisms (e.g., Vite's built-in .env handling) to load environment variables.

## Configuration Management
- **Python**: Centralize configuration loading in a dedicated module (e.g., `shared/config.py`).
- **Vue**: Access environment variables via `import.meta.env` (Vite) or `process.env` (Node.js context).

## Environment-Specific Behavior
- Code should adapt its behavior based on the current environment where appropriate (e.g., logging levels, feature flags, API endpoints).
- Use environment variables to control these differences.

## Secrets Management
- For production and sensitive environments, use a secure secrets management solution (e.g., HashiCorp Vault, AWS Secrets Manager, Doppler) instead of relying solely on .env files.
- The application should be configured to fetch secrets from these services at startup or runtime.

## Consistency
- Ensure all developers and deployment environments use a consistent method for managing and accessing configuration.
"""
    create_mdc_file(
        "006-environment-configuration.mdc",
        "Environment Configuration",
        "Standards for managing environment variables and application configuration across dev, test, and prod.",
        globs=[".env*", "**/config.py", "**/vite.config.js"],
        always_apply=True,
        content=environment_config_content
    )

    # Create Assistant Guidelines rule
    assistant_guidelines_content = """# AI Coding Assistant Guidelines (For You, My AI Pair Programmer)

## My Preferences & How to Best Help Me

1.  **Simplicity First**: Always prefer simple, clear, and straightforward solutions. Avoid over-engineering.
2.  **DRY (Don't Repeat Yourself)**: Before writing new code, please check if similar functionality already exists in the codebase. If it does, let's discuss reusing or refactoring it.
3.  **Environment Awareness**: When generating code or configurations, consider the differences between `dev`, `test`, and `prod` environments. For example, logging levels, API endpoints, or feature flags might differ.
4.  **Focused Changes**: Only make changes that are directly requested or that you are highly confident are well-understood and directly related to the current task. If you have suggestions for other improvements, please bring them up for discussion separately.
5.  **Respect Existing Patterns**: When fixing bugs or adding features, try to follow the existing patterns and technologies in the codebase. If a new pattern or technology is truly necessary, let's discuss it first. If we introduce something new, we should also aim to remove the old, redundant implementation.
6.  **Cleanliness & Organization**: Help me keep the codebase clean, well-organized, and easy to navigate. This includes consistent naming, logical file structures, and adherence to our defined standards.
7.  **Avoid One-Off Scripts in Files**: If a script is only meant to be run once (e.g., a migration or a specific data processing task), let's discuss creating it as a separate, temporary script file rather than embedding it within application code. For recurring tasks, we can create proper management commands or utility scripts in designated locations (like the `scripts/` directory).
8.  **File Size Limits**: Remind me if files are growing too large (e.g., over 200-300 lines for Python/JS). We should refactor them into smaller, more manageable modules.
9.  **No Stubs/Fake Data in Dev/Prod**: Never add stubbed data, mock implementations, or fake data patterns directly into code that affects the `dev` or `prod` environments. Test data and mocks belong in test environments or testing-specific files.
10. **.env File Protection**: NEVER overwrite my `.env` file or any environment-specific `.env.*` files without explicitly asking for confirmation and explaining why.
11. **Tool Usage**: When you use tools (like file editing, terminal commands, or search):
    *   Explain *why* you are using the tool and what you expect to achieve before calling it.
    *   If a tool call fails or the result isn't what you expected, please let me know and we can troubleshoot or try a different approach.
12. **Rule Adherence**: Please pay close attention to all `.cursor/rules/*.mdc` files. If you're ever unsure how a rule applies, ask me.
13. **Incremental Development**: I prefer to work in small, incremental steps. Let's break down larger tasks into smaller, manageable chunks.
14. **Commit Often**: Remind me to commit changes frequently with clear, conventional commit messages.
15. **Ask Questions**: If my instructions are unclear or if you see potential issues with my approach, please don't hesitate to ask clarifying questions or suggest alternatives. Your proactive input is valuable!

## Our Workflow
- I'll describe the task or problem.
- You can ask clarifying questions or suggest an approach.
- We'll agree on a plan.
- You'll help implement the solution, using tools as needed.
- We'll test and iterate.
- I'll commit the changes.

Let's build some great software together!
"""
    create_mdc_file(
        "007-assistant-guidelines.mdc",
        "AI Coding Assistant Guidelines",
        "Instructions and preferences for how the AI assistant should behave and collaborate.",
        always_apply=True, # This should always be active for our interactions
        content=assistant_guidelines_content
    )

    # --- Agent Framework Specific Guidelines ---
    # These will be stored in a subdirectory: .cursor/rules/agent-frameworks/

    agent_frameworks_dir = Path(".cursor/rules/agent-frameworks")
    agent_frameworks_dir.mkdir(parents=True, exist_ok=True)

    # OpenAI SDK Guidelines
    openai_sdk_content = """# OpenAI Agent SDK Guidelines

## General Principles
- Utilize the official OpenAI Python SDK for interactions with OpenAI models (GPT-3.x, GPT-4, Embeddings, etc.).
- Keep API keys secure using environment variables and never commit them.
- Handle API errors gracefully (e.g., rate limits, server errors, authentication issues).

## Client Initialization
- Initialize the OpenAI client once and reuse it where possible (e.g., using FastAPI dependency injection).
- Configure necessary parameters like API key, organization (if applicable).

## Model Usage
- **Chat Completions (`gpt-3.5-turbo`, `gpt-4`, etc.)**:
  - Structure prompts clearly with system, user, and assistant messages.
  - Use appropriate parameters like `temperature`, `max_tokens`, `top_p` based on the desired output (creative vs. factual).
  - Be mindful of token limits and context window sizes.
- **Embeddings (`text-embedding-ada-002`, etc.)**:
  - Use for semantic search, clustering, and other text similarity tasks.
  - Batch requests where possible for efficiency.
- **Function Calling**:
  - Define functions clearly with JSON schema for parameters.
  - Handle function call responses from the model and execute the corresponding local functions.

## Prompt Engineering
- Develop clear, specific, and effective prompts.
- For complex tasks, consider few-shot prompting or chain-of-thought prompting techniques.
- Iterate on prompts based on model responses.

## Streaming Responses
- For interactive applications (like chatbots), use streaming for chat completions to provide faster perceived responsiveness.

## Error Handling and Retries
- Implement retry mechanisms with exponential backoff for transient API errors.
- Catch specific OpenAI exceptions (e.g., `openai.error.RateLimitError`, `openai.error.AuthenticationError`).

## Cost Management
- Be aware of the pricing for different models and API calls.
- Optimize token usage by keeping prompts concise and using `max_tokens` appropriately.
- Monitor API usage through the OpenAI dashboard.

## Versioning
- Pin the OpenAI SDK version in `requirements.txt` to ensure stable behavior.
- Be aware of potential breaking changes when upgrading the SDK.
"""
    create_mdc_file(
        "agent-frameworks/101-openai-sdk-guidelines.mdc", # Note subdirectory
        "OpenAI SDK Guidelines",
        "Best practices for using the OpenAI Python SDK to build agent capabilities.",
        globs=["**/llm_mcp.py", "**/openai_utils.py", "*/*openai*/**.py"], # Globs for files likely to use OpenAI SDK
        always_apply=False, # Apply when relevant files are in context or explicitly requested
        content=openai_sdk_content
    )

    # CrewAI Guidelines
    crew_ai_content = """# CrewAI Guidelines

## Core Concepts
- **Agents**: Define specialized agents with distinct roles, goals, and backstories.
- **Tasks**: Break down complex problems into smaller, manageable tasks assigned to agents.
- **Tools**: Equip agents with tools (functions) to interact with external systems or perform specific actions.
- **Crews**: Assemble agents into crews to collaborate on solving tasks.
- **Process**: Define the workflow sequence (e.g., sequential, hierarchical).

## Agent Definition
- Provide a clear `role` for each agent.
- Define a specific `goal` that the agent aims to achieve.
- Write a concise `backstory` to give context and personality to the agent.
- Set `allow_delegation` to `True` or `False` based on whether the agent can delegate tasks to others.
- Use `verbose=True` during development for better insight into agent actions.

## Task Definition
- Write a clear `description` for each task, including expected inputs and outputs.
- Assign an `agent` responsible for executing the task.
- Provide `expected_output` to guide the agent and for validation.

## Tool Creation
- Define tools as Python functions.
- Use the `@tool` decorator from `crewai_tools`.
- Ensure tools have clear names and docstrings explaining their purpose, arguments, and return values.
- Tools should be focused and perform a single, well-defined action.

## Crew Composition
- Select agents appropriate for the overall goal of the crew.
- Define the `tasks` to be executed by the crew.
- Choose a `process` (e.g., `Process.sequential`) that fits the workflow.
- Consider using a `manager_llm` for more complex crew coordination if needed.

## Running and Debugging
- Use the `kickoff()` method to start the crew's execution.
- Utilize `verbose=True` (for agents and/or crew) to understand the decision-making process.
- Inspect the output of each task and agent interaction.

## Best Practices
- Start with simple crews and gradually increase complexity.
- Clearly define the responsibilities and capabilities of each agent.
- Ensure tasks are well-defined and achievable by the assigned agents.
- Design tools to be robust and handle potential errors.
- Iterate on agent roles, goals, tasks, and tools based on observed performance.
"""
    create_mdc_file(
        "agent-frameworks/102-crew-ai-guidelines.mdc",
        "CrewAI Guidelines",
        "Best practices for building multi-agent systems with CrewAI.",
        globs=["*/*crew*/**.py", "*/*_crew.py"], # Globs for files likely to use CrewAI
        always_apply=False,
        content=crew_ai_content
    )

    # Langchain Guidelines
    langchain_content = """# Langchain Guidelines

## Core Components
- **Models (LLMs, ChatModels, Embeddings)**: Interface with various language models.
- **Prompts (PromptTemplates, ChatPromptTemplate)**: Manage and optimize inputs to models.
- **Chains (LLMChain, SequentialChain)**: Combine LLMs and prompts for sequences of calls.
- **Indexes (DocumentLoaders, TextSplitters, VectorStores, Retrievers)**: Structure and retrieve data for LLMs.
- **Memory**: Enable chains and agents to remember previous interactions.
- **Agents**: Allow LLMs to make decisions, take actions, and observe results.
- **Callbacks**: Log and stream intermediate steps of any chain.

## General Principles
- Understand the specific Langchain module you are using (e.g., `langchain-core`, `langchain-openai`, `langchain-community`).
- Favor LCEL (Langchain Expression Language) for composing chains due to its composability and built-in streaming/batch/async support.
- Keep track of Langchain versions, as the library evolves rapidly.

## Model Usage
- Choose appropriate models (LLMs vs. ChatModels) based on the task.
- Configure model parameters (e.g., `temperature`, `model_name`) explicitly.

## Prompt Management
- Use `PromptTemplate` or `ChatPromptTemplate` for dynamic prompt generation.
- Clearly define input variables in templates.
- For chat models, structure prompts with `SystemMessage`, `HumanMessage`, and `AIMessage`.

## Chain Construction (LCEL)
- Use the pipe operator (`|`) to connect components (prompts, models, output parsers).
- Leverage `RunnablePassthrough` and `RunnableParallel` for complex data flows.
- Use `StrOutputParser` or custom output parsers to format model outputs.

## RAG (Retrieval Augmented Generation)
- **Document Loading**: Use appropriate `DocumentLoader` (e.g., `PyPDFLoader`, `WebBaseLoader`).
- **Text Splitting**: Choose a `TextSplitter` (e.g., `RecursiveCharacterTextSplitter`) with appropriate chunk size and overlap.
- **Vector Stores**: Select a vector store (e.g., FAISS, Chroma) and embedding model.
- **Retrievers**: Configure retrievers (e.g., `as_retriever()`) with search parameters like `k`.
- Construct RAG chains using LCEL, typically: `{"context": retriever, "question": RunnablePassthrough()} | prompt | model | StrOutputParser()`.

## Agents
- Understand the different agent types (e.g., ReAct, OpenAI Functions Agent).
- Define tools clearly with names, descriptions, and Pydantic models for arguments if needed.
- Be cautious with agents that can execute arbitrary code or interact with external systems.

## Memory
- Choose appropriate memory types (e.g., `ConversationBufferMemory`) for the application.
- Integrate memory correctly into chains or agents.

## Debugging and Observability
- Use Langsmith (https://smith.langchain.com/) for tracing, monitoring, and debugging Langchain applications.
- Utilize `verbose=True` (where available) or callbacks for local debugging.
"""
    create_mdc_file(
        "agent-frameworks/103-langchain-guidelines.mdc",
        "Langchain Guidelines",
        "Best practices for developing LLM applications with Langchain.",
        globs=["*/*langchain*/**.py", "*/*_chain.py"], # Globs for files likely to use Langchain
        always_apply=False,
        content=langchain_content
    )

    # LangGraph Guidelines
    langgraph_content = """# LangGraph Guidelines

## Core Concepts
- **Stateful Graphs**: LangGraph is designed for building stateful, multi-actor applications like agents.
- **Nodes**: Represent functions or callables that perform actions (e.g., calling an LLM, a tool, or updating state).
- **Edges**: Define the flow of control between nodes. Edges can be conditional.
- **State**: A central object (often a Pydantic model or TypedDict) that is passed between nodes and updated by them.
- **CompiledGraph**: The executable graph object.

## Graph Definition
- **State Definition**: Define a TypedDict or Pydantic model to represent the graph's state. This state is modified by nodes.
- **Nodes**: Implement nodes as functions that take the current state as input and return a dictionary of updates to the state.
  - Use `functools.partial` or lambdas if nodes need access to external resources not in the state.
- **Adding Nodes**: Use `graph.add_node("node_name", node_function)`.
- **Edges**: 
  - **Entry Point**: `graph.set_entry_point("start_node_name")`.
  - **Normal Edges**: `graph.add_edge("source_node", "destination_node")` for unconditional transitions.
  - **Conditional Edges**: `graph.add_conditional_edges("source_node_for_decision", condition_function, {"path_a": "node_for_path_a", "path_b": "node_for_path_b"})`.
    - The `condition_function` takes the current state and returns the name of the next edge/node to follow.
  - **Finish Point**: Define nodes that can be terminal states using `END` (e.g., `graph.add_edge("some_node", END)`).

## Compiling and Running
- **Compilation**: `app = graph.compile()`.
- **Execution**: `app.invoke({"initial_state_key": value})` for single runs.
- **Streaming**: Use `app.stream()` or `app.astream()` to get intermediate results from nodes as they execute.

## Best Practices
- **Modularity**: Keep nodes focused on a single task or decision.
- **State Management**: Design the state object carefully. It's the primary way information flows through the graph.
- **Error Handling**: Implement error handling within nodes or as separate paths in the graph.
- **Debugging**: Utilize the streaming capabilities (`astream_log`) to inspect intermediate states and transitions. Langsmith integration is highly recommended.
- **Loops**: LangGraph naturally supports cycles/loops, which are essential for agentic behavior (e.g., re-prompting, tool use cycles).
- **Human-in-the-Loop**: Design nodes that can pause execution and wait for human input if needed.

## Comparison to LCEL
- LangGraph is built on top of LCEL but provides a higher-level abstraction for cyclic graphs and state management, which are common in agent development.
- Use LCEL for simpler, linear chains; use LangGraph for more complex, stateful, and potentially cyclic agentic flows.
"""
    create_mdc_file(
        "agent-frameworks/104-langgraph-guidelines.mdc",
        "LangGraph Guidelines",
        "Best practices for building stateful, multi-actor applications with LangGraph.",
        globs=["*/*langgraph*/**.py", "*/*_graph.py"], # Globs for files likely to use LangGraph
        always_apply=False,
        content=langgraph_content
    )

    print("All rule files processed.") 
# Orchestrator AI (Monorepo) - v0.1.0

## Overview

Orchestrator AI is a multi-agent system designed to handle various tasks through a conversational interface. It features a central orchestrator agent that intelligently delegates tasks to specialized sub-agents. The system maintains conversational context and is accessed via an Ionic Vue frontend application.

**Key Capabilities (v0.1.0):**
*   Orchestration of tasks to specialized agents (e.g., blog writing, metrics reporting).
*   Maintenance of conversation context using session IDs and chat history.
*   Web-based chat interface for user interaction.

## Directory Structure

```
orchestrator-ai/
├── apps/
│   ├── api/            # FastAPI backend (Orchestrator, Sub-Agents)
│   └── web/            # Ionic Vue frontend application
├── docs/
│   └── versions/
│       └── 0.1/
│           └── ARCHITECTURE.md # Detailed architecture
├── shared/             # Shared utilities (currently minimal)
├── .env                # Local environment variables (gitignored)
├── .env.example        # Example environment variables
├── package.json        # Root project scripts and Node.js dependencies
├── pyproject.toml      # Root Python project definition (PDM)
└── README.md           # This file
```

## Prerequisites

*   **Node.js**: v18.x or later (npm v9.8.1 or as specified in root `package.json`).
*   **Python**: v3.13 (as specified in `pyproject.toml`).
*   **PDM**: Python Dependency Manager. Install via pip: `pip install pdm`.
*   **Git**: For version control.
*   **OpenAI API Key**: Required for the orchestrator's decision-making capabilities.

## Setup & Installation

1.  **Clone the Repository**:
    ```bash
    git clone <your_repository_url>
    cd orchestrator-ai
    ```

2.  **Install Root Node.js Dependencies**:
    (Handles tools like Turbo, Prettier, and workspace script execution)
    ```bash
    npm install
    ```

3.  **Backend API Setup**:
    ```bash
    cd apps/api
    python3 -m pdm install
    cd ../.. # Back to project root
    ```

4.  **Frontend Web Application Setup**:
    ```bash
    cd apps/web
    npm install
    cd ../.. # Back to project root
    ```

5.  **Environment Configuration**:
    *   At the project root (`orchestrator-ai/`), create a `.env` file. You can copy from `.env.example` if one is provided.
    *   Add your OpenAI API key to the `.env` file:
        ```env
        OPENAI_API_KEY="sk-yourActualOpenAIKeyHere"
        # Add any other necessary environment variables
        ```

## Running the Application

Ensure you are in the project root directory (`orchestrator-ai/`).

*   **Full Development Mode (API & Frontend with Auto-Reload)**:
    This is the recommended way to run the application during development.
    ```bash
    npm run dev
    ```
    *   The API will typically be available at `http://localhost:8000`.
    *   The Frontend will typically be available at `http://localhost:5173` (or as specified by its dev server).

*   **API Only (with Auto-Reload)**:
    ```bash
    npm run dev:api
    ```
    API logs will be visible in the terminal.

*   **Frontend Only (with Auto-Reload)**:
    ```bash
    npm run dev:web
    ```
    Frontend build logs and server information will be in the terminal.

## Example Interactions (Test Cases for v0.1)

These examples demonstrate the basic capabilities and context memory:

1.  **Greeting and Name Recognition**:
    *   **User**: "Hi, my name is Matt."
    *   **Agent**: (Should acknowledge the name, e.g., "Hello Matt! How can I assist you today?")

2.  **Context Recall**:
    *   **User**: (After introducing name) "Do you remember my name?"
    *   **Agent**: (Should confirm the name, e.g., "Yes, your name is Matt.")

3.  **Delegation to Blog Post Agent**:
    *   **User**: "Can you write me a blog post about the future of AI?"
    *   **Agent**: (Should delegate to a blog post agent, e.g., "Certainly! I'll get started on a blog post about the future of AI for you.")

4.  **Delegation to Metrics Agent**:
    *   **User**: "What are the sales figures from last year?"
    *   **Agent**: (Should delegate to a metrics agent, e.g., "Let me check the sales figures from last year for you.")

---
*This README provides a general guide for v0.1.0. For more detailed architectural information, see `docs/versions/0.1/ARCHITECTURE.md`.* 
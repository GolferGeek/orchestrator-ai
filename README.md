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

## Supabase Database Migrations

This project uses the Supabase CLI to manage database schema changes for the remote Supabase SaaS project. Migration files are stored in the `/supabase/migrations/` directory.

**Workflow:**

1.  **Login to Supabase CLI (One-time per machine/user)**:
    ```bash
    npm run supabase:login
    ```
    Follow the prompts to authenticate with your Supabase account.

2.  **Link Local Project to Remote Supabase Project (One-time per local project clone)**:
    You'll need your Supabase Project Reference ID (from your Supabase project dashboard: Settings > General).
    Edit the `YOUR_PROJECT_REF_HERE` placeholder in the `package.json` script for `supabase:link` or run directly:
    ```bash
    supabase link --project-ref <your-actual-project-ref>
    ```
    Enter your database password when prompted.

3.  **Creating a New Migration**:
    *   **Option A: Write SQL Manually**
        1.  Create a new SQL file in `supabase/migrations/` named with a timestamp prefix (e.g., `YYYYMMDDHHMMSS_my_descriptive_name.sql`).
        2.  Write your DDL statements (CREATE TABLE, ALTER TABLE, etc.) in this file.
    *   **Option B: Pull Changes Made in Supabase Studio**
        If you've made schema changes directly in the Supabase Dashboard Studio and want to capture them as a migration:
        ```bash
        npm run supabase:db:pull
        ```
        This will generate a new migration file in `supabase/migrations/` based on the differences between your linked remote database and the last known migration state.
        You can also use the helper script which prompts for a name:
        ```bash
        npm run supabase:migrate:new 
        # (Then enter a descriptive name for the migration when prompted)
        ```

4.  **Applying Migrations to Remote Database**:
    To apply any pending local migration files (from `supabase/migrations/`) to your linked remote Supabase project:
    ```bash
    npm run supabase:migrate:up
    ```
    You may be prompted for your database password.

5.  **Resetting Remote Database (Use with Extreme Caution - Dev/Staging ONLY)**:
    If you need to reset your linked remote database and reapply all migrations (e.g., for a clean development or staging environment):
    ```bash
    npm run supabase:db:reset:remote
    ```
    You will be asked for confirmation as this is a destructive operation.

**Important Notes:**
*   Always commit your migration files to version control.
*   It's recommended to have separate Supabase projects for development, staging, and production, and manage migrations accordingly.
*   For triggers on `auth.users` (like the `handle_new_user` function), it's often more reliable to create the trigger itself via the Supabase Dashboard (Database > Triggers section) after the function is created by a migration, due to potential permission issues.

---
*This README provides a general guide for v0.1.0. For more detailed architectural information, see `docs/versions/0.1/ARCHITECTURE.md`.* 
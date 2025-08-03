# PRD: Hierarchical Orchestrator & Project Management System

**Version:** 1.0
**Status:** Approved
**Author:** Orchestrator AI

## 1. Executive Summary

This document outlines the requirements for evolving Orchestrator AI into a hierarchical organization of intelligent agents managed by a new class of **Orchestrator Agents**. This architecture introduces **Projects**: robust, long-running workflows that are planned collaboratively with users, executed asynchronously with full persistence, and managed through a redesigned UI. This initiative will transform the platform from a collection of specialist tools into a cohesive, scalable system capable of solving complex, multi-step business problems.

## 2. Overview

This document outlines the requirements for evolving Orchestrator AI from a system of independent agents into a cohesive, hierarchical organization of intelligent agents managed by a new class of **Orchestrator Agents**. This new architecture introduces the concept of **Projects**, long-running, multi-step tasks that are planned collaboratively with the user, executed asynchronously, and managed through a redesigned, intuitive user interface.

## 3. Problem Statement

The current agent architecture, while effective for single, specialized tasks, lacks a mechanism for coordinating complex, multi-agent workflows. The original monolithic orchestrator concept proved to be brittle and unscalable. Users have no way to manage long-running processes, provide iterative feedback, or understand the relationships and capabilities of the various agents in the system. This limits the platform's ability to tackle sophisticated, real-world problems.

## 4. Goals & Objectives

*   **Goal:** Create a scalable, robust system for orchestrating complex, multi-agent workflows.
*   **Objectives:**
    *   Establish a clear, hierarchical command structure for agents, defined in their configuration.
    *   Enable users to initiate and manage long-running, asynchronous "Projects".
    *   Ensure all user-facing interactions are intuitive, interactive, and provide constant context.
    *   Maintain full A2A (Agent-to-Agent) compliance for all agents through a strict inheritance model.
    *   Decompose backend logic into well-defined, testable, and maintainable services.

## 5. Core Concepts

### 5.1. Glossary
*   **Orchestrator Agent:** A meta-agent responsible for managing a team of subordinate agents, classifying user intent, and managing Projects.
*   **Project:** A long-running, stateful workflow with a defined plan, managed by an Orchestrator. The master record for a complex task.
*   **Plan:** A declarative JSON blueprint that defines the steps, dependencies, and data flow of a Project.
*   **Checkpointer:** The LangGraph persistence engine that automatically saves a snapshot of a Project's state after every step.
*   **Interrupt:** A LangGraph feature that allows a Project to be paused to wait for external input, primarily for human-in-the-loop actions.
*   **Forking / Time Travel:** A LangGraph feature that allows a Project's history to be rewound to a previous checkpoint, enabling a user to "go back" and try a different path.
*   **Delegation Context:** A manually curated `delegation.context.md` file that provides an Orchestrator with its explicit knowledge of its subordinates.

### 5.2. Orchestrator Agents

Orchestrators are a new class of agent that manage a "team" of subordinate agents. They are modeled after a corporate hierarchy. An orchestrator's primary function is to understand a user's high-level goal and decide on the best course of action:
1.  **Converse:** Engage in simple chat.
2.  **Delegate:** Assign a simple, single-step task to the appropriate specialist agent on its team.
3.  **Plan & Execute a Project:** For complex requests, initiate a multi-step Project.

#### Initial Orchestrator Hierarchy
The system will implement the following orchestrator agents:

*   **CEO Orchestrator (`ceo_orchestrator`):** The top-level orchestrator with broad delegation authority across all specialist agents and subordinate orchestrators. Handles complex, cross-functional projects and high-level strategic tasks.
*   **Marketing Manager Orchestrator (`marketing_manager`):** Manages all marketing-related specialist agents (marketing_swarm, etc.) and reports directly to the CEO. Handles marketing campaigns, content strategy, and brand management tasks.

### 5.3. Projects & Tasks

**Projects** and **Tasks** serve different roles in the system:

#### Projects
A **Project** is the top-level container for a long-running, stateful workflow designed to achieve a complex goal.
*   It is initiated and managed by an Orchestrator Agent within a conversation.
*   It consists of a **Plan** that is interactively developed and approved by the user.
*   Each step in the plan is a **Project Step**, creating a one-to-many relationship (`projects` to `project_steps`).
*   Projects are asynchronous and their status is persisted in the database, allowing users to track progress over time.

#### Tasks and Project Steps
The system uses two distinct types of work units:

**Tasks** (A2A protocol level):
*   A2A tasks for simple, single-step delegations to specialist agents
*   A2A tasks for project management operations (create_project, approve_plan, etc.)

**Project Steps** (internal project execution):
*   Individual execution steps within a project's plan
*   Created and managed internally during project execution
*   Stored in the `project_steps` table with `project_id` foreign key

This separation allows the system to handle both simple requests ("generate a marketing email") and complex workflows ("launch a complete marketing campaign") while maintaining clear A2A protocol compliance.

### 5.4. The "Plan-Approve-Act" Lifecycle

Complex requests are not executed immediately. They follow a mandatory, interactive lifecycle:
1.  **Plan:** The Orchestrator and user collaborate conversationally to define a plan of action.
2.  **Approve:** The Orchestrator presents the final, human-readable plan to the user for explicit approval.
3.  **Act:** Only after user approval does the Orchestrator begin executing the plan, step by step.

## 6. Backend Architecture

### 6.1. Database Schema

The data model establishes a flexible hierarchy that maintains A2A protocol compliance:

*   A new **`projects`** table will be created to store the state of long-running workflows, with:
    *   `conversation_id` foreign key linking to the originating conversation
    *   `task_id` foreign key linking to the parent A2A task that created the project
*   A new **`project_steps`** table will be created to store the individual execution steps within projects, with:
    *   `project_id` foreign key linking to the parent project
    *   Step metadata (step_id, status, agent assignments, etc.)
*   The existing **`tasks`** table remains unchanged and contains only A2A tasks for:
    *   Simple delegations to specialist agents
    *   Project management operations (create_project, approve_plan, etc.)

This creates two execution paths while maintaining A2A compliance:
*   **Simple flow:** Conversation → A2A Task (direct delegation to specialist agents)
*   **Complex flow:** Conversation → A2A Task (project management) → Project → Project Steps (execution steps)

All project operations (create, plan, approve, resume, retry, abort) flow through A2A tasks, ensuring protocol compliance while enabling rich project functionality.

### 6.2. Service Contracts & Data Flow

To ensure clarity and type safety, the interactions between services will be governed by explicit interfaces and Data Transfer Objects (DTOs).

*   **`OrchestratorInput`:** The primary DTO passed into the system, containing `prompt`, `userId`, `conversationId`, `delegationContext`, `conversationHistory`, and optional `projectId` for project-related operations.
*   **`IntentDirective`:** The output of the `IntentRecognitionService`, an object specifying the determined `action` (e.g., 'DELEGATE', 'CREATE_PROJECT', 'RESUME_PROJECT'), an optional `agentName`, and the `prompt`.
*   **`OrchestratorResponse`:** The final object returned by the A2A entry point, containing an optional `message`, `delegationTaskId`, or `projectId`.
*   **A2A Entry Point:** The `OrchestratorAgentBaseService` will implement the abstract `executeTask(method, params)` method. This method's sole responsibility is to adapt the incoming A2A/JSON-RPC request into the `OrchestratorInput` DTO and delegate the entire workflow to the `OrchestratorFacadeService`.

#### A2A Protocol Compliance for Projects

Projects operate within the A2A protocol boundary by wrapping all project operations as A2A tasks:

*   **Project Creation:** Initial A2A task with method `"create_project"` creates the project internally
*   **Project Management:** Subsequent A2A tasks handle project lifecycle:
    *   `"update_project_plan"` - Collaborative planning iterations
    *   `"approve_project_plan"` - Plan approval/rejection
    *   `"resume_project"` - Continue paused project
    *   `"retry_project_step"` - Retry failed step
    *   `"abort_project"` - Terminate project

*   **A2A Task Metadata:** Project-related tasks include `project_id` in params for context:
    ```json
    {
      "method": "approve_project_plan",
      "params": {
        "prompt": "Looks good, let's proceed",
        "project_id": "123",
        "conversation_id": "456"
      }
    }
    ```

*   **Data Model Relationship:** Projects have a `task_id` foreign key linking to their parent A2A task, maintaining protocol compliance while enabling rich project functionality.

### 6.3. Service-Oriented Design

The orchestrator's logic will be decomposed into a set of specialized, composable services:
*   **`OrchestratorService`:** The main public-facing coordinator.
*   **`IntentRecognitionService`:** Classifies user intent (Converse, Delegate, Plan).
*   **`DelegationService`:** Manages single-task delegations, including proxying real-time WebSocket updates from the specialist agent.
*   **`PlanningService`:** Manages the interactive, conversational loop to generate a `PlanDefinition` JSON.
*   **`PlanExecutionService`:** The LangGraph-based engine that executes an approved plan.

### 6.4. Core Engine Architecture

*   **`PlanDefinition` JSON Structure:** The plan generated by the `PlanningService` will be a structured JSON object. It will define a series of `steps`, each with a unique `stepId`. The execution order will be controlled by a `dependencies` array within each step, allowing for both sequential and concurrent step execution. Steps will have a `type` (`agent_step` or `human_approval`) and can reference the outputs of previous steps for data flow.
*   **LangGraph-based Intent Recognition:** The `IntentRecognitionService` will be implemented as a stateful LangGraph. This "decision graph" will analyze the user's prompt and recent conversation history to intelligently determine the correct action (`CONVERSE`, `DELEGATE`, `CONTINUE_DELEGATION`, `PLAN`). This allows the orchestrator to handle conversational context and follow-up questions accurately.
*   **LangGraph Execution & Persistence Model:** The `PlanExecutionService` will leverage the full power of LangGraph's state management and persistence features:
    *   **Checkpointer for Persistence:** The graph will be compiled with a `PostgresSaver` checkpointer, automatically saving a snapshot of the project state after every step.
    *   **Interrupts for Human-in-the-Loop:** A `human_approval` step will be implemented as a node that signals an "interrupt" to the LangGraph engine, pausing the graph until user input is received.
    *   **Time Travel for Reverting & Correcting:** The checkpointer's history of all state snapshots will be exposed via an API, allowing the backend to fork the project's history from a previous checkpoint at the user's request.

### 6.5. Agent Integration

*   **Inheritance Model:** To ensure A2A compliance, all orchestrators will inherit from a new `OrchestratorAgentBaseService`, which in turn inherits from the root `A2AAgentBaseService`.
*   **Orchestrator Context Management:** An orchestrator's knowledge of its subordinates will be managed through a dual-mechanism:
    *   **Delegation Context (`delegation.context.md`):** Each orchestrator will have a dedicated, manually curated markdown file that defines who it is authorized to command. This is the source of truth for the backend logic. The context files will be defined at build time and updated manually as the organization evolves.
    *   **Organizational Chart (`agent.yaml`):** Each agent will have a `reportsTo` field used exclusively by the `AgentDiscoveryService` to construct the visual Organization Chart for the frontend UI.

#### Specific Hierarchy Implementation
The initial implementation will establish the following reporting structure:
*   Marketing specialist agents → `marketing_manager` orchestrator
*   `marketing_manager` orchestrator → `ceo_orchestrator`
*   All other specialist agents → `ceo_orchestrator` (direct reports)

### 6.6. Error Handling & Recovery

Project failures are not terminal states but opportunities for user-guided recovery.

*   **Project-Level Failures:** If a step within a project fails, the `PlanExecutionService` will catch the error, change the project's status to a new `paused_on_error` state, and log the error details. The execution of the project is paused indefinitely until the user takes action.
*   **User-Driven Recovery:** The UI will detect the `paused_on_error` status and **must** present the user with three explicit recovery options:
    1.  **Retry:** Re-run the failed step.
    2.  **Go Back:** Use the "Time Travel" feature to revert the project to the state before the failed step.
    3.  **Abort:** Terminate the project permanently.
*   **Service-Level Failures:** Failures within other services will be handled with standard NestJS exceptions and formatted into A2A-compliant error responses.

## 7. Frontend Architecture

### 7.1. Key API Endpoints
*   `GET /api/agents/hierarchy`: Returns the nested JSON for the visual Organization Chart.
*   `POST /api/projects`: Creates a new project and begins the planning phase.
*   `GET /api/projects`: Lists all of the user's projects.
*   `GET /api/projects/:projectId`: Retrieves the full state of a specific project for rehydrating the UI.
*   `GET /api/projects/:projectId/history`: Retrieves the list of historical checkpoints for the "Time Travel" UI.
*   `POST /api/projects/:projectId/resume`: Provides input to a project that is `paused_for_human`.
*   `POST /api/projects/:projectId/retry`: Re-runs the last failed step for a project that is `paused_on_error`.
*   `POST /api/projects/:projectId/fork`: Reverts a project's state to a previous checkpoint.
*   `POST /api/projects/:projectId/abort`: Terminates a project.

### 7.2. Left Navigation

*   **"Organization" Tab:** Displays an interactive, expandable "Organization Chart" as the primary navigation.
*   **"Projects" Tab:** Displays a global dashboard of the user's active and paused projects.

### 7.3. Main Content Views

*   **Orchestrator Workspace:** The main view when an orchestrator is selected. This is where the interactive plan-building and approval process occurs.
*   **Project Detail Page:** A dedicated view for a single project (`/projects/:projectId`), featuring a visual plan, a live log stream, and prompts for human-in-the-loop and error recovery actions.

### 7.4. Project UI Flow Details

#### Planning Phase UI
**Location:** Orchestrator Workspace (main content area when an orchestrator is selected)
*   **Interactive Planning Loop:** Conversational interface where user and orchestrator collaborate to define the project plan through back-and-forth dialogue
*   **Plan Presentation:** Orchestrator presents the final, structured plan in human-readable format for user review
*   **Approval Interface:** Explicit user action (approve/modify buttons) required before execution begins
*   **Plan Modification:** User can request changes, triggering another planning iteration

#### Project Status Monitoring UI
**Location:** Multiple coordinated views
*   **Projects Dashboard** (`/projects` - "Projects" tab): 
    *   Global overview of all user's projects with status indicators
    *   Quick access to individual project details
    *   Filter/sort by status (running, paused, completed, etc.)
*   **Project Detail Page** (`/projects/:projectId`):
    *   **Visual Plan Visualizer:** Graphical representation of project steps and dependencies
    *   **Live Log Stream:** Real-time updates as tasks execute with WebSocket connectivity
    *   **Status Indicators:** Current project state with clear visual cues
    *   **Progress Tracking:** Step-by-step completion status

#### Project Completion & Recovery UI
**Location:** Project Detail Page with context-sensitive displays
*   **Human-in-the-Loop Prompts:** Interactive prompts when project pauses for user input (`paused_for_human` state)
*   **Error Recovery Interface:** When project fails (`paused_on_error` state), present three explicit options:
    *   **Retry Button:** Re-run the failed task with confirmation
    *   **Go Back Button:** Time travel to previous checkpoint with checkpoint selection
    *   **Abort Button:** Terminate the project with confirmation dialog
*   **History View:** Timeline of all project checkpoints enabling "time travel" functionality
*   **Completion Display:** Final state presentation when project reaches `completed` status with summary of results

#### Real-time Features
*   **WebSocket Integration:** Live updates during task execution and delegation
*   **Status Synchronization:** All UI components reflect current backend state automatically
*   **Interactive Org Chart:** Visual representation of delegation hierarchy with click-to-delegate functionality

### 7.5. WebSocket Messaging Architecture

Building on the existing task messaging system, project-related WebSocket events provide real-time updates:

#### Message Types
*   **A2A Task Messages** (existing, enhanced):
    *   Include `project_id` metadata when task is project-related
    *   Standard task status updates for project management operations
*   **Project-Specific Messages** (new):
    *   `project.status.changed` - Project state transitions (planning → running → paused, etc.)
    *   `project.plan.created` - New plan ready for user review
    *   `project.plan.approved` - User approved plan, execution starting
    *   `project.paused.human_input` - Project waiting for user input
    *   `project.paused.error` - Error occurred, recovery options available
    *   `project.completed` - Project finished successfully
*   **Project Step Messages** (new):
    *   `project.step.started` - Internal project step began execution
    *   `project.step.completed` - Internal project step finished
    *   `project.step.failed` - Internal project step failed

#### WebSocket Rooms
*   `project:{projectId}` - All updates for a specific project
*   `user:{userId}:projects` - All project-related updates for a user
*   Existing task rooms continue to handle A2A task updates

#### UI Subscription Strategy
*   **Projects Dashboard:** Subscribe to `user:{userId}:projects` for project status overview
*   **Project Detail Page:** Subscribe to `project:{projectId}` for detailed project and internal step updates
*   **Orchestrator Workspace:** Subscribe during planning phase for plan-related events

## 8. Key Features & User Stories

*   **As a User, I want to see the entire agent organization in a hierarchical chart** so I can understand who does what and who reports to whom.
*   **As a User, I want to give a complex, high-level goal to an orchestrator** and have it create a detailed plan for me to review.
*   **As a User, I want to approve or suggest changes to a proposed plan** before any work begins.
*   **As a User, I want to track the progress of my long-running projects** from a central dashboard.
*   **As a User, when I delegate a task, I want to see the real-time progress updates** from the specialist agent performing the work.
*   **As a User, when a project step fails, I want to be notified and given explicit options to retry, go back, or abort,** so I can recover the project without starting over.
*   **As a User, I want to be notified when a project needs my input** so I can unblock the workflow.

---
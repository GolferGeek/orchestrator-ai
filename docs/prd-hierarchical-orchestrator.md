# PRD: Hierarchical Orchestrator & Project Management System

**Version:** 1.1
**Status:** Approved
**Author:** Orchestrator AI

## 1. Executive Summary

This document outlines the requirements for evolving Orchestrator AI into a hierarchical organization of intelligent agents managed by a new class of **Orchestrator Agents**. This architecture introduces **Projects**: robust, long-running workflows that are planned collaboratively with users, executed asynchronously with full persistence, and managed through a redesigned UI. This initiative will transform the platform from a collection of specialist tools into a cohesive, scalable system capable of solving complex, multi-step business problems.

## 2. Overview

This document outlines the requirements for evolving Orchestrator AI from a system of independent agents into a cohesive, hierarchical organization of intelligent agents managed by a new class of **Orchestrator Agents**. This new architecture introduces the concept of **Projects**, long-running, multi-step tasks that are planned collaboratively with the user, executed asynchronously, and managed through a redesigned, intuitive user interface.

## 3. Problem Statement

The current agent architecture, while effective for single, specialized tasks, lacks a mechanism for coordinating complex, multi-agent workflows. The original monolithic orchestrator concept proved to be brittle and unscalable. Users have no way to manage long-running processes, provide iterative feedback, or understand the relationships and capabilities of the various agents in the system. This limits the platform's ability to tackle sophisticated, real-world problems.

## 4. Goals & Objectives

*   **Goal:** Create a scalable, robust system for orchestrating complex, multi-agent workflows that enables businesses to build permanent, specialized agent workforces.
*   **Objectives:**
    *   Establish a clear, hierarchical command structure for agents, defined in their configuration.
    *   Enable users to initiate and manage long-running, asynchronous "Projects" spanning weeks to months.
    *   **Enable dynamic workforce expansion** through agent creation and improvement as part of project workflows.
    *   **Position as enterprise organizational intelligence** rather than competing with quick throwaway agent builders.
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
*   **Subproject:** A child project created from a parent project step, managed independently by a different orchestrator while maintaining parent-child relationship tracking.
*   **Cross-Department Orchestration:** The ability for high-level orchestrators (CEO, CTO, CMO, CFO) to coordinate complex workflows across multiple departments through subproject delegation.
*   **Agent Creation Step:** A specialized project step where orchestrators build new permanent agents to fill capability gaps, involving Context.md creation and deployment.
*   **Agent Improvement Step:** A project step focused on enhancing existing agents based on performance feedback and evolving business requirements.
*   **Workforce Development:** The ongoing process of expanding and improving an organization's agent capabilities as a core business function.

### 5.2. Orchestrator Agents

Orchestrators are a new class of agent that manage a "team" of subordinate agents. They are modeled after a corporate hierarchy. An orchestrator's primary function is to understand a user's high-level goal and decide on the best course of action:
1.  **Converse:** Engage in simple chat.
2.  **Delegate:** Assign a simple, single-step task to the appropriate specialist agent on its team.
3.  **Plan & Execute a Project:** For complex requests, initiate a multi-step Project.

#### Initial Orchestrator Hierarchy
The system will implement the following orchestrator agents:

*   **CEO Orchestrator (`ceo_orchestrator`):** The top-level orchestrator with broad delegation authority across all specialist agents and subordinate orchestrators. Handles complex, cross-functional projects and high-level strategic tasks.
*   **Marketing Manager Orchestrator (`marketing_manager`):** Manages all marketing-related specialist agents (marketing_swarm, etc.) and reports directly to the CEO. Handles marketing campaigns, content strategy, and brand management tasks.

### 5.3. Projects, Subprojects & Tasks

**Projects**, **Subprojects**, and **Tasks** serve different roles in the hierarchical system:

#### Projects & Subprojects
A **Project** is the top-level container for a long-running, stateful workflow designed to achieve a complex goal.
*   It is initiated and managed by an Orchestrator Agent within a conversation.
*   It consists of a **Plan** that is interactively developed and approved by the user.
*   **Complex projects can be decomposed into Subprojects** - independent workflows managed by different orchestrators.
*   Each step in the plan can be either a **Project Step** (direct execution) or a **Subproject** (delegated to another orchestrator).
*   **Subprojects** are full projects in their own right, with their own plans, execution, and lifecycle management.
*   **Parent-child relationships** are tracked, allowing hierarchical project visualization and dependency management.
*   Projects are asynchronous and their status is persisted in the database, allowing users to track progress over time.

#### Subproject Architecture
When a project requires cross-departmental coordination or specialized expertise:
*   **CEO Orchestrator** can create subprojects for CTO (technical implementation), CMO (marketing strategy), CFO (budget planning)
*   **Each subproject** is managed independently by the appropriate orchestrator
*   **Parallel execution** is possible when subprojects have no dependencies
*   **Dependency management** ensures proper sequencing when subprojects depend on each other
*   **Status aggregation** provides parent project visibility into all subproject states

#### Tasks and Project Steps
The system uses multiple types of work units to support enterprise-scale operations:

**Tasks** (A2A protocol level):
*   A2A tasks for simple, single-step delegations to specialist agents
*   A2A tasks for project management operations (create_project, approve_plan, etc.)

**Project Steps** (internal project execution):
*   **Standard Execution Steps:** Individual tasks within a project's plan
*   **Agent Creation Steps:** Build new permanent agents to fill capability gaps
*   **Agent Improvement Steps:** Enhance existing agents based on performance feedback
*   **Workforce Development Steps:** Strategic planning and deployment of agent capabilities
*   **Subproject Delegation Steps:** Create child projects managed by other orchestrators
*   Created and managed internally during project execution
*   Stored in the `project_steps` table with `project_id` foreign key

**Enterprise Step Types:**
*   **`build_agent`:** Create new Context.md-driven or function-based agents
*   **`improve_agent`:** Enhance existing agent capabilities and context
*   **`deploy_team`:** Roll out new agent capabilities across the organization
*   **`evaluate_performance`:** Assess agent effectiveness and identify improvement opportunities

This separation allows the system to handle both simple requests ("generate a marketing email") and complex workflows ("launch a complete marketing campaign") while maintaining clear A2A protocol compliance.

### 5.4. The "Plan-Approve-Act" Lifecycle

Complex requests are not executed immediately. They follow a mandatory, interactive lifecycle:
1.  **Plan:** The Orchestrator and user collaborate conversationally to define a plan of action.
2.  **Approve:** The Orchestrator presents the final, human-readable plan to the user for explicit approval.
3.  **Act:** Only after user approval does the Orchestrator begin executing the plan, step by step.

## 6. Backend Architecture

### 6.1. Database Schema

The data model establishes a flexible hierarchy that maintains A2A protocol compliance and supports subproject relationships:

*   A new **`projects`** table will be created to store the state of long-running workflows, with:
    *   `conversation_id` foreign key linking to the originating conversation
    *   **`parent_project_id`** foreign key for subproject hierarchies (nullable for top-level projects)
    *   **`orchestrator_agent`** field to track which orchestrator manages this project
*   A new **`project_steps`** table will be created to store the individual execution steps within projects, with:
    *   `project_id` foreign key linking to the parent project
    *   **`subproject_id`** field for steps that spawn subprojects (nullable)
    *   Step metadata (step_id, status, agent assignments, etc.)
*   **Subproject dependencies** tracked in a new **`project_dependencies`** table:
    *   `project_id` and `depends_on_project_id` for inter-project relationships
    *   Dependency type (blocking, informational, resource-sharing)
*   The existing **`tasks`** table remains unchanged and contains only A2A tasks for:
    *   Simple delegations to specialist agents
    *   Project management operations (create_project, approve_plan, etc.)
    *   **Subproject management operations** (create_subproject, aggregate_status, etc.)

This creates three execution paths while maintaining A2A compliance:
*   **Simple flow:** Conversation → A2A Task (direct delegation to specialist agents)
*   **Complex flow:** Conversation → A2A Task (project management) → Project → Project Steps (execution steps)
*   **Hierarchical flow:** Conversation → A2A Task (project management) → Parent Project → Subprojects → Parallel/Sequential Execution

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

*   **A2A Task Metadata:** Project-related tasks include `project_id` and optional `parent_project_id` in params for context:
    ```json
    {
      "method": "approve_project_plan",
      "params": {
        "prompt": "Looks good, let's proceed",
        "project_id": "123",
        "parent_project_id": "456",
        "conversation_id": "789"
      }
    }
    ```

*   **Subproject Management Operations:** New A2A methods for hierarchical project management:
    *   `"create_subproject"` - Create a child project managed by a different orchestrator
    *   `"aggregate_subproject_status"` - Roll up status from all child projects
    *   `"manage_subproject_dependencies"` - Coordinate cross-subproject dependencies
    *   `"sync_subproject_completion"` - Handle parent project continuation after subproject completion

*   **Data Model Relationship:** Projects exist within conversation context and are managed through A2A task operations, maintaining protocol compliance while enabling rich project functionality.

### 6.3. Service-Oriented Design

The orchestrator's logic will be decomposed into a set of specialized, composable services, each making LLM calls rather than using complex logic trees:

*   **`OrchestratorFacadeService`:** The main coordinator that routes requests through the single A2A entry point.
*   **`IntentRecognitionService`:** Uses LLM calls to classify user intent (Converse, Delegate, Plan) based on conversation context.
*   **`DelegationService`:** Manages single-task delegations, including proxying real-time WebSocket updates from the specialist agent.
*   **`PlanningService`:** Manages the interactive, iterative conversational loop with multiple LLM calls to collaboratively generate a `PlanDefinition` JSON with the user. **Enhanced with subproject decomposition logic** to identify when steps should become independent subprojects.
*   **`PlanExecutionService`:** The LangGraph-based engine that executes an approved plan, potentially using ReAct patterns for reasoning and action-taking. **Enhanced with subproject coordination** for managing parent-child project relationships.
*   **`SubprojectManagementService`:** New service for hierarchical project management:
    *   Subproject creation and orchestrator assignment
    *   Dependency tracking and validation
    *   Status aggregation from child projects
    *   Cross-subproject communication coordination

### 6.4. Core Engine Architecture

*   **`PlanDefinition` JSON Structure:** The plan generated by the `PlanningService` will be a structured JSON object. It will define a series of `steps`, each with a unique `stepId`. The execution order will be controlled by a `dependencies` array within each step, allowing for both sequential and concurrent step execution. Steps will have a `type` (`agent_step`, `human_approval`, or **`subproject`**) and can reference the outputs of previous steps for data flow. **Subproject steps** include `assigned_orchestrator` and `subproject_scope` fields for delegation.
*   **LangGraph-based Intent Recognition:** The `IntentRecognitionService` will be implemented as a stateful LangGraph. This "decision graph" will analyze the user's prompt and recent conversation history to intelligently determine the correct action (`CONVERSE`, `DELEGATE`, `CONTINUE_DELEGATION`, `PLAN`). This allows the orchestrator to handle conversational context and follow-up questions accurately.
*   **LangGraph Execution & Persistence Model:** The `PlanExecutionService` will leverage the full power of LangGraph's state management and persistence features:
    *   **Checkpointer for Persistence:** The graph will be compiled with a `SupabaseCheckpointSaver` checkpointer, automatically saving a snapshot of the project state after every step.
    *   **Interrupts for Human-in-the-Loop:** A `human_approval` step will be implemented as a node that signals an "interrupt" to the LangGraph engine, pausing the graph until user input is received.
    *   **Time Travel for Reverting & Correcting:** The checkpointer's history of all state snapshots will be exposed via an API, allowing the backend to fork the project's history from a previous checkpoint at the user's request.

#### LangGraph State Architecture for Hierarchical Projects

Each project (parent or subproject) maintains its own LangGraph state with three core data structures:

```typescript
interface ProjectExecutionState {
  // Core execution state
  projectId: string;
  threadId: string; // Unique LangGraph thread for each project
  currentStepId: string;
  status: ProjectStatus;
  
  // The Plan: Execution blueprint stored as structured JSON
  plan: PlanDefinition; // Contains steps, dependencies, agent assignments, human assignments
  
  // The Data: Agent outputs and artifacts (can become very large)
  stepResults: Record<string, any>; // All agent outputs, reports, generated content
  
  // The Metadata: Checkpoint and execution tracking
  metadata: Record<string, any>; // Includes checkpoint info, parent/child references
  
  // Step tracking arrays
  completedSteps: string[];
  failedSteps: string[];
  stepErrors: Record<string, ClassifiedError[]>;
  retryAttempts: Record<string, number>;
}
```

#### Hierarchical State Management

*   **Parent Projects:** Maintain lightweight coordination state with references to subprojects
*   **Subprojects:** Maintain full detailed execution state with complete `stepResults` data
*   **State Isolation:** Each project level has its own LangGraph thread and checkpoint history
*   **Cross-Project Communication:** Parent projects aggregate status from child projects without storing child data

#### Data Volume Management for Enterprise Scale

The hierarchical project structure creates significant data management challenges:

**Scale Considerations:**
*   **Parent Projects:** Lightweight coordination with minimal stepResults (typically <1MB)
*   **Subprojects:** Full execution state with potentially massive stepResults (could reach 10-100MB+)
*   **Multi-Level Hierarchies:** Sub-subprojects create recursive data aggregation challenges
*   **Enterprise Scope:** Complex projects may spawn 20+ subprojects across departments

**Database Storage Strategy:**
*   **Supabase JSONB Limits:** Practical performance limit ~1-10MB per field
*   **Large stepResults:** Store in Supabase Storage with references in state
*   **State Segmentation:** Each project maintains its own LangGraph state and database records

**Frontend Performance Strategy:**
*   **Lazy Loading:** Initial load shows hierarchy-summary without full stepResults
*   **On-Demand Detail:** Load complete-state only when user drills into specific projects
*   **Progressive Enhancement:** Show lightweight status first, detailed results on user interaction
*   **WebSocket Efficiency:** Subscribe to hierarchy-level updates, not individual project data streams

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

### 5.4. Enterprise Workforce Development

The system is designed as **enterprise organizational intelligence** that builds permanent, specialized agent workforces rather than disposable automation tools.

#### Dynamic Agent Creation & Improvement
*   **Permanent Workforce Expansion:** Projects can include "build team" steps where orchestrators create new agents as permanent organizational assets
*   **Specialized Agent Focus:** Each agent performs one function exceptionally well, rather than being a complex multi-purpose tool
*   **Context-Driven Agents:** Simple agents powered by well-crafted Context.md files that define their expertise and role
*   **Function-Based Agents:** Single-purpose agents that can be built using Claude Code integration for more complex capabilities
*   **Hot Deployment:** New agents appear in the organization without system restarts

#### Enterprise Timeline & Scope
*   **Business-Scale Projects:** Project timelines span weeks to months, not minutes or hours
*   **Strategic Workforce Planning:** Marketing managers identify capability gaps and systematically build specialized teams
*   **Institutional Knowledge:** Agents become repositories of business processes and domain expertise that improve over time
*   **Competitive Differentiation:** Unlike throwaway agent builders (Copilot, GPT Builder), this creates defensible business value through accumulated organizational intelligence

#### User-Driven Agent Development
*   **Expert-Led Creation:** Business experts (marketing managers, operations leads) drive agent design and Context.md development
*   **Collaborative Improvement:** Users review and refine agent contexts with system assistance
*   **Performance-Based Enhancement:** Agent improvement cycles based on real business outcomes and user feedback
*   **Organizational Learning:** Each agent becomes better through exposure to real business scenarios and expert guidance

### 6.6. Error Handling & Recovery

Project failures are not terminal states but opportunities for user-guided recovery and workforce improvement.

#### Traditional Error Recovery
*   **Project-Level Failures:** If a step within a project fails, the `PlanExecutionService` will catch the error, change the project's status to a new `paused_on_error` state, and log the error details. The execution of the project is paused indefinitely until the user takes action.
*   **User-Driven Recovery:** The UI will detect the `paused_on_error` status and **must** present the user with recovery options:
    1.  **Retry:** Re-run the failed step.
    2.  **Go Back:** Use the "Time Travel" feature to revert the project to the state before the failed step.
    3.  **Abort:** Terminate the project permanently.
*   **Service-Level Failures:** Failures within other services will be handled with standard NestJS exceptions and formatted into A2A-compliant error responses.

#### Enterprise Workforce Development Pauses
The system introduces new pause states for long-term workforce development:

*   **`paused_for_agent_development`:** Project paused while business experts design and build new agents (days to weeks)
*   **`paused_for_agent_improvement`:** Project paused while existing agents are enhanced based on performance feedback
*   **`paused_for_capability_assessment`:** Project paused while evaluating whether current agent workforce can handle requirements
*   **`paused_for_workforce_planning`:** Project paused while strategic decisions are made about agent team composition

#### Recovery & Improvement Workflows
*   **Agent Creation Recovery:** When a step fails due to missing capabilities, automatically suggest agent creation as recovery path
*   **Performance-Based Improvement:** Track agent performance metrics to identify improvement opportunities during project execution
*   **Institutional Learning:** Failed attempts become training data for agent improvement rather than just errors to retry

## 7. Frontend Architecture

### 7.1. Key API Endpoints
*   `GET /api/agents/hierarchy`: Returns the nested JSON for the visual Organization Chart.
*   `POST /api/projects`: Creates a new project and begins the planning phase.
*   `GET /api/projects`: Lists all of the user's projects.
*   `GET /api/projects/:projectId`: Retrieves the full state of a specific project for rehydrating the UI.
*   **`GET /api/projects/:projectId/subprojects`**: Lists all subprojects under a parent project.
*   **`GET /api/projects/:projectId/hierarchy`**: Returns the complete project hierarchy tree.
*   `GET /api/projects/:projectId/history`: Retrieves the list of historical checkpoints for the "Time Travel" UI.
*   `POST /api/projects/:projectId/resume`: Provides input to a project that is `paused_for_human`.
*   `POST /api/projects/:projectId/retry`: Re-runs the last failed step for a project that is `paused_on_error`.
*   `POST /api/projects/:projectId/fork`: Reverts a project's state to a previous checkpoint.
*   `POST /api/projects/:projectId/abort`: Terminates a project.
*   **`POST /api/projects/:projectId/subprojects`**: Creates a new subproject under a parent project.
*   **`GET /api/projects/:projectId/status-aggregate`**: Returns aggregated status of project and all subprojects.
*   **`POST /api/agents/create`**: Create new agent with Context.md and configuration.
*   **`PUT /api/agents/:agentId/improve`**: Enhance existing agent capabilities based on feedback.
*   **`GET /api/agents/:agentId/performance`**: Retrieve agent performance metrics and improvement opportunities.
*   **`POST /api/projects/:projectId/pause-for-development`**: Pause project for workforce development activities.
*   **`PUT /api/projects/:projectId/steps/:stepId/assign-human`**: Assign human expert to specific project step.
*   **`GET /api/projects/:projectId/human-assignments`**: Get all human assignments for a project.
*   **`GET /api/projects/:projectId/complete-state`**: Recursively gather full state from project hierarchy.
*   **`GET /api/projects/:projectId/hierarchy-summary`**: Lightweight overview of project tree without stepResults data.

### 7.2. Left Navigation

*   **"Organization" Tab:** Displays an interactive, expandable "Organization Chart" as the primary navigation.
*   **"Projects" Tab:** Displays a global dashboard of the user's active and paused projects.

### 7.3. Main Content Views

*   **Orchestrator Workspace:** The main view when an orchestrator is selected. This is the primary interface for all orchestrator interactions including conversations, simple task delegations, and the interactive plan-building and approval process for complex projects.
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
    *   **Hierarchical project tree view** showing parent-child relationships
    *   **Subproject status roll-up** with expandable project hierarchies
    *   Quick access to individual project details
    *   Filter/sort by status (running, paused, completed, etc.)
    *   **Cross-project dependency visualization**
*   **Project Detail Page** (`/projects/:projectId`):
    *   **Visual Plan Visualizer:** Graphical representation of project steps and dependencies
    *   **Subproject Integration Panel:** Embedded views of active subprojects with delegation status
    *   **Live Log Stream:** Real-time updates as tasks execute with WebSocket connectivity
    *   **Status Indicators:** Current project state with clear visual cues
    *   **Progress Tracking:** Step-by-step completion status
    *   **Hierarchical Progress View:** Parent project progress incorporating subproject completion
    *   **Hierarchical Data Aggregation:** Lazy-loading interface to drill down into subproject stepResults without overwhelming the UI

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
*   **As a User, I want complex projects to be automatically decomposed into subprojects** managed by appropriate department orchestrators (CTO, CMO, CFO, etc.).
*   **As a User, I want to see the hierarchical relationship between parent projects and subprojects** with clear visualization of dependencies.
*   **As a User, I want subprojects to execute in parallel when possible** to minimize total project completion time.
*   **As a User, I want to monitor the aggregated status of a parent project** including progress from all active subprojects.
*   **As a User, I want to drill down into individual subprojects** while maintaining context of the parent project goals.
*   **As a Business Owner, I want my marketing manager to identify capability gaps and build specialized agents** to permanently expand our marketing capabilities.
*   **As a Department Manager, I want to pause projects to focus on building the right agents for my team** rather than trying to force existing agents to do work they're not designed for.
*   **As a User, I want agents that get better over time through real business experience** rather than starting from scratch with each new project.
*   **As an Enterprise Customer, I want to build organizational intelligence that becomes more valuable over time** creating switching costs and competitive advantages.
*   **As a User, I want simple Context.md-driven agents for straightforward tasks** and function-based agents for more complex specialized work.
*   **As a Business User, I want to review and improve agent Context.md files** to ensure they reflect our specific business processes and expertise.

## 9. Strategic Market Position

### 9.1. Competitive Differentiation

**This system is positioned as Enterprise Organizational Intelligence, not a throwaway agent builder.**

#### vs. Microsoft Copilot Studio / GPT Builder
*   **Them:** "Build a quick agent to help with a task"
*   **Us:** "Build a permanent marketing department that gets smarter over time"

#### vs. Quick Agent Builders
*   **Them:** Disposable automation tools for individual tasks
*   **Us:** Permanent workforce expansion with institutional knowledge accumulation

#### vs. Traditional Business Automation
*   **Them:** Replace human tasks with rigid workflows
*   **Us:** Augment human expertise with specialized AI team members

### 9.2. Value Proposition

#### For Small-Medium Businesses
*   **Affordable departmental expertise** without hiring full-time specialists
*   **Scalable capabilities** that grow with business needs
*   **Competitive advantage** through custom AI workforce

#### For Large Enterprises
*   **Standardized processes** across departments and locations
*   **Institutional knowledge preservation** beyond employee turnover
*   **Strategic workforce planning** with AI capability mapping

### 9.3. Switching Costs & Defensibility

#### High Switching Costs
*   **Months of Context.md development** represent significant investment
*   **Agent performance data** accumulated over time
*   **Organizational workflows** built around specific agent capabilities
*   **Institutional knowledge** embedded in agent contexts

#### Network Effects
*   **Agent performance improves** with more usage and feedback
*   **Cross-department coordination** becomes more sophisticated over time
*   **Business process optimization** compounds with agent maturity

### 9.4. Business Model Implications

#### Customer Acquisition
*   **Executive-level buying decisions** (CEO, CTO, CMO level)
*   **Strategic business transformation** sales cycle
*   **Proof-of-concept focused** on building small agent teams

#### Customer Retention
*   **Deep integration** with business processes
*   **Accumulated value** increases over time
*   **Expansion revenue** through additional departments and agent capabilities

---
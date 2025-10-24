# **Development Plan: Hierarchical Orchestrator & Project Management System**

**Version:** 1.1
**Document Status:** Final
**Related PRD:** `docs/prd-hierarchical-orchestrator.md`

## **Phase 1: Backend Foundation & Configuration**

This phase focuses on establishing the foundational database structures, agent configurations, and service contracts.

### **Task 1.1: Database Schema Migration**

*   **Objective:** Create the necessary database tables to support A2A-compliant project operations.
*   **Actions:**
    1.  Create a new Supabase migration script.
    2.  Define the `projects` table with:
        *   `conversation_id` foreign key linking to the originating conversation
        *   Status field with values: `'planning'`, `'running'`, `'paused_for_human'`, `'paused_on_error'`, `'completed'`, and `'aborted'`
    3.  Create a new `project_steps` table with:
        *   `project_id` foreign key linking to the parent project
        *   Step metadata (step_id, status, agent assignments, dependencies, etc.)
    4.  The existing `tasks` table remains unchanged and contains only A2A tasks for simple delegations and project management operations

### **Task 1.2: Define Service Contracts & DTOs**

*   **Objective:** Formally define the interfaces and data transfer objects (DTOs) for A2A-compliant project operations.
*   **Actions:**
    1.  Create `orchestration.types.ts`.
    2.  In this file, define the core DTOs: 
        *   `OrchestratorInput` (with optional `projectId` for project-related operations)
        *   `IntentDirective` (with actions like 'CREATE_PROJECT', 'RESUME_PROJECT', etc.)
        *   `OrchestratorResponse`
        *   `PlanDefinition` and `ProjectState`
    3.  Define A2A method types for project operations: `create_project`, `update_project_plan`, `approve_project_plan`, `resume_project`, `retry_project_step`, `abort_project`
    4.  Define the public method signatures for each service as TypeScript interfaces.

### **Task 1.3: Create Orchestrator Module & Service Stubs**

*   **Objective:** Establish the co-located directory structure and placeholder service files.
*   **Actions:**
    1.  Create the directory structure under `apps/api/src/agents/base/implementations/base-services/orchestrator/`.
    2.  Create stub files for each service, implementing the interfaces from Task 1.2.
    3.  Wire the services together in `orchestrator.module.ts`.


## **Phase 2: Backend Implementation - Agent Integration & Discovery**

This phase focuses on the base classes and discovery mechanisms that allow agents to function within the new hierarchy.

### **Task 2.1: Implement Orchestrator Inheritance & Context Loading**

*   **Objective:** Implement the A2A-compliant base class for all orchestrators.
*   **Actions:**
    1.  Implement the `OrchestratorAgentBaseService`, ensuring it inherits from `A2AAgentBaseService`.
    2.  Implement the A2A `executeTask` method, which will adapt the incoming request into the `OrchestratorInput` DTO and call the facade service.
    3.  Implement the explicit loading of the `delegation.context.md` file during the `onModuleInit` lifecycle hook.

### **Task 2.2: Implement Hierarchical Discovery Service**

*   **Objective:** Implement the discovery process to build the organizational chart for the UI.
*   **Actions:**
    1.  Modify `AgentDiscoveryService` to parse the `reportsTo` field and build a cached, nested JSON object of the agent hierarchy.
    2.  Create the `GET /api/agents/hierarchy` endpoint to serve this cached JSON to the frontend.

## **Phase 3: Backend Implementation - Core Logic Engine**

This phase implements the "brain" of the orchestrator.

### **Task 3.1: Implement LangGraph-based `IntentRecognitionService`**

*   **Objective:** Build the stateful decision engine to classify user intent.
*   **Actions:**
    1.  Implement a `StateGraph` with a `DecisionState` to track conversational context.
    2.  Implement the classification nodes and conditional edges to create the routing logic.
    3.  Implement the service-level error handling for failed LLM calls.

### **Task 3.2: Implement `PlanningService`**

*   **Objective:** Create the interactive, iterative planning loop with multiple LLM calls.
*   **Actions:**
    1.  Implement the `createPlan` method to manage the back-and-forth conversational loop with multiple LLM calls for collaborative planning.
    2.  Implement iterative plan refinement based on user feedback and requests for changes.
    3.  Implement the `PlanFormatterService` to translate the plan JSON into a human-readable format.
    4.  Implement the service-level error handling for LLM call failures.

### **Task 3.3: Implement `PlanExecutionService` with LangGraph**

*   **Objective:** Build the engine that executes project plans, potentially using ReAct patterns.
*   **Actions:**
    1.  **Setup Checkpointer:** Compile the `StateGraph` with a `PostgresSaver` checkpointer.
    2.  **Implement Dynamic Graph Builder:** Create the logic to build the graph from a `PlanDefinition`.
    3.  **Implement Core Nodes & Edges:** Implement the logic for `human_approval` (interrupts), `agent_step` nodes, and the conditional edges for "go back" functionality.
    4.  **Implement ReAct Pattern:** Consider using LangGraph's ReAct functionality for reasoning and action-taking within the execution engine.
    5.  **Implement Message Proxying:** Ensure the `agent_step` node subscribes to and re-emits messages from sub-steps.
    6.  **Implement Project-Level Error Handling:** Implement the `try...catch` block around agent invocations and the logic to transition the project state to `paused_on_error`.

### **Task 3.4: Implement `DelegationService` & `OrchestratorFacadeService`**

*   **Objective:** Implement the final logic services with single A2A entry point architecture.
*   **Actions:**
    1.  Implement the `DelegationService`, including its real-time message proxying.
    2.  Implement the `OrchestratorFacadeService` as the main coordinator that routes all requests through the single A2A entry point and coordinates the full "Plan-Approve-Act" lifecycle.

## **Phase 4: Orchestrator Agent Creation & API Implementation**

This phase creates the actual orchestrator agents and builds the user interface.

### **Task 4.1: Create Orchestrator Agent Implementations**

*   **Objective:** Build the actual orchestrator agent implementations that will manage the hierarchy.
*   **Actions:**
    1.  **Create CEO Orchestrator:** Create directory structure and implementation at `apps/api/src/agents/actual/orchestrator/ceo_orchestrator/` with broad delegation authority.
    2.  **Create Marketing Manager Orchestrator:** Create directory structure and implementation at `apps/api/src/agents/actual/orchestrator/marketing_manager/` to manage marketing specialists.
    3.  **Create Agent Configuration Files:** Create `agent.yaml` files for both orchestrators with appropriate metadata and reporting relationships.
    4.  **Register in Agent Factory:** Update the agent discovery and factory systems to recognize and instantiate the new orchestrator agents.

### **Task 4.2: Update Agent Configurations**

*   **Objective:** Update existing agent configurations to support the new hierarchical model.
*   **Actions:**
    1.  **Update YAML Files:** Update marketing-related agents to add `reportsTo: marketing_manager` and update `marketing_manager` to add `reportsTo: ceo_orchestrator` to establish the hierarchy.
    2.  **Create Delegation Contexts:** Create `delegation.context.md` files for both CEO and Marketing Manager orchestrators, defining their explicit subordinate relationships for the backend.

### **Task 4.3: Implement All Backend API Endpoints**

*   **Objective:** Create all the necessary API endpoints to support the frontend UI and A2A project operations.
*   **Actions:**
    1.  Create a new `ProjectsController`.
    2.  Implement all project-related endpoints, including those for recovery (`retry`, `fork`, `abort`) and history (`GET /history`).
    3.  Enhance existing WebSocket gateway to support project-specific message types:
        *   Project status changes (`project.status.changed`)
        *   Project planning events (`project.plan.created`, `project.plan.approved`)
        *   Project pause events (`project.paused.human_input`, `project.paused.error`)
        *   Internal project step events (`project.step.started`, `project.step.completed`, `project.step.failed`)
    4.  Create WebSocket rooms for project-specific subscriptions (`project:{projectId}`, `user:{userId}:projects`).

### **Task 4.4: Implement Core Frontend Layout**

*   **Objective:** Overhaul the main application layout to include the new tabbed navigation.
*   **Actions:**
    1.  Modify the root layout component (`App.vue` or similar).
    2.  Create the `TabbedSideNav.vue` component containing the "Organization" and "Projects" tabs.

### **Task 4.5: Implement "Organization" & "Projects" Tabs**

*   **Objective:** Create the interactive org chart and the project dashboard.
*   **Actions:**
    1.  Create the `OrganizationChart.vue` component with click-to-delegate functionality, fetching data from the hierarchy API.
    2.  Create the `ProjectsList.vue` component for the project dashboard with status filtering and sorting.

### **Task 4.6: Implement Orchestrator Workspace (All Interactions UI)**

*   **Objective:** Build the comprehensive interface for all orchestrator interactions including conversations, simple delegations, and project planning.
*   **Actions:**
    1.  Create the `OrchestratorWorkspace.vue` component as the main content area for all orchestrator interactions.
    2.  Implement conversational interface for simple chat and task delegations.
    3.  Implement interactive planning interface with message history and real-time updates for complex projects.
    4.  Create plan presentation component with structured, human-readable format.
    5.  Implement approval interface with approve/modify buttons and plan modification flow.

### **Task 4.7: Implement Project Detail Page (Monitoring & Recovery UI)**

*   **Objective:** Build the comprehensive project management dashboard.
*   **Actions:**
    1.  Create the `ProjectDetailPage.vue` view with multiple coordinated sections.
    2.  Create child components:
        *   `ProjectPlanVisualizer.vue` - Graphical representation of steps and dependencies
        *   `LiveLogStream.vue` - Real-time step execution updates with WebSocket integration
        *   `ProjectStatusIndicator.vue` - Clear visual status representation
        *   `ProjectProgressTracker.vue` - Step-by-step completion tracking
    3.  Create the `HumanInTheLoopPrompt.vue` component for user input during `paused_for_human` state.
    4.  Implement error recovery interface:
        *   `ErrorRecoveryOptions.vue` - Retry/Go Back/Abort buttons with confirmations
        *   `ProjectHistory.vue` - Timeline view for checkpoint selection
        *   `CheckpointSelector.vue` - Interface for time travel functionality
    5.  Create `ProjectCompletion.vue` component for final state display with results summary.

## **Phase 5: Integration & End-to-End Testing**

*   **Objective:** Ensure all backend and frontend components work together seamlessly.
*   **Actions:**
    1.  Perform end-to-end testing of the "Plan-Approve-Act" lifecycle.
    2.  Test the real-time proxying of the `DelegationService`.
    3.  Test the human-in-the-loop pause and resume functionality.
    4.  Test the "Time Travel" (forking) and error recovery features.
    5.  Verify that all UI components correctly reflect the state changes from the backend.
    6.  Write integration tests for the service layer.

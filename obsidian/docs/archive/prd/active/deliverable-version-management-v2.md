---
slug: deliverable-version-management-v2
title: Enhanced Deliverable Version Management with Delete, Task-Based Creation, and AI Merge
owner: golfergeek
reviewers: [team]
created: 2025-01-11
target-window: 2025-01-11 .. 2025-01-25
success-metrics:
  - Users can delete non-current versions in <3 clicks
  - Task-based version creation completes in <30 seconds
  - Version merge operations complete in <60 seconds
  - Zero data loss incidents during deletion/merge operations
risk-level: medium
deps: [existing deliverable system, LLM service integration]
non-goals:
  - Audit trail or version lineage tracking
  - Soft deletion or version recovery
  - Admin permission system (future iteration)
  - Conflict resolution UI (LLM handles automatically)
---

## 1. Summary
Enhance the deliverable version management system within the A2A conversation paradigm to support version deletion, task-based version creation, and AI-powered merging through natural language conversations. Users will interact with agents via conversation to manage versions, request specific modifications, and intelligently combine content from multiple versions using conversational prompts.

## 2. Problem & Goals
- Problem: Users accumulate unwanted deliverable versions with no conversational way to remove them, cannot request targeted modifications through agents without getting unwanted enhancements, and have no conversational interface to combine the best parts of multiple versions intelligently.
- Goals:
  - Enable users to delete unwanted versions through conversation (except current version)
  - Allow conversational task-based version creation with strict scope control (no enhancements beyond user request)
  - Provide AI-powered version merging through conversational natural language instructions
  - Maintain data integrity and prevent accidental loss of current versions in A2A operations

## 3. Scope
- In scope:
  - Conversational version deletion commands (hard delete of non-current versions)
  - A2A agent integration for version management tasks
  - Conversational version creation through task requests
  - LLM-powered version merging through conversation prompts
  - Agent capabilities for deliverable version operations
  - UI integration with conversation pane for version selection
- Out of scope:
  - Direct REST API endpoints (everything goes through A2A conversation)
  - Version recovery or soft deletion
  - Audit trail of merge operations
  - Admin permission system
  - Manual conflict resolution interface
  - Cross-deliverable version operations

## 4. Deliverables (Definition of Done)
- User-visible deliverables:
  - Context-aware prompt input that moves to appropriate pane (conversation/deliverable/project)
  - Conversation always visible in left pane for context and agent responses
  - Version management operations triggered from deliverable context with conversation display
  - Agent responses with version operation results and conflict summaries in conversation
  - Confirmation dialogs for destructive operations within deliverable context
  - Ability to create new deliverables from deliverable list (requires agent selection)
- Internal deliverables:
  - Metadata-driven routing system in A2AAgentBaseService
  - Enhanced DeliverableVersionsService with deleteVersion and mergeVersions methods
  - Frontend metadata structure for context-aware task creation
  - UI state management for active context (conversation/deliverable/project)
  - Prompt input component that adapts to active context
- Acceptance criteria:
  - Prompt input appears in conversation pane when no deliverable/project active
  - Prompt input moves to deliverable pane when deliverable context is active
  - Prompt input moves to project pane when project context is active
  - Users can delete versions from deliverable context with metadata: { context: "deliverable", method: "delete", versionIds: [...] }
  - Agent prevents deletion of current version with conversational feedback
  - Task-based version creation from deliverable context: { context: "deliverable", method: "newVersion", deliverableId: "id", prompt: "user request" }
  - Version merging from deliverable context: { context: "deliverable", method: "merge", deliverableId: "id", versionIds: [...], prompt: "merge instructions" }
  - Users can create new deliverables from list with agent selection and initial prompt
  - All operations maintain A2A compliance with structured metadata routing
  - Frontend updates deliverable displays and conversation simultaneously

## 5. Constraints & Assumptions
- Constraints: A2A conversation paradigm compliance, hard delete only, current user permissions only, no direct API access
- Assumptions: Agent conversation system is available and reliable, versions are primarily markdown content, users understand conversational commands, merge conflicts can be resolved automatically by agent LLM

## 6. Technical Plan
- Architecture:
  - Use structured metadata approach to eliminate complex intent recognition
  - Frontend sends explicit context and method in task metadata
  - Backend routes based on metadata.context ("conversation", "deliverable", "project") and metadata.method
  - Use existing DeliverableVersionsService (already injected in A2AAgentBaseService)
  - Maintain conversation display in left pane while routing operations contextually
- Data model changes:
  - No schema changes required (existing deliverable_versions table sufficient)
  - Add new created_by_type values: 'conversation_task', 'conversation_merge'
- A2A Integration Pattern:
  - Frontend sends structured metadata: { context: "deliverable", method: "newVersion", deliverableId: "uuid", prompt: "user request" }
  - A2AAgentBaseService executeTask() routes based on metadata.context and metadata.method
  - No intent recognition needed - explicit method routing
  - Direct calls to existing service methods with new methods for merge functionality
- Metadata-Driven Command Patterns:
  - Delete: { context: "deliverable", method: "delete", versionIds: ["id1", "id2"] }
  - New Version: { context: "deliverable", method: "newVersion", deliverableId: "id", prompt: "update the intro" }
  - Merge: { context: "deliverable", method: "merge", deliverableId: "id", versionIds: ["id1", "id2"], prompt: "merge instructions" }
  - New Deliverable: { context: "deliverable", method: "create", agentType: "blog-writer", agentName: "Blog Writer", prompt: "write a blog post about AI" }
  - Conversation: { context: "conversation", prompt: "what can you do?" }
  - Project Operations: { context: "project", method: "addStep", projectId: "id", prompt: "add testing phase" }
- Services/modules to touch:
  - Extend apps/api/src/agents/base/implementations/base-services/a2a-base/a2a-agent-base.service.ts (metadata routing)
  - Update apps/api/src/deliverables/deliverable-versions.service.ts (add deleteVersion and mergeVersions methods)
  - apps/web/src/stores/agentChatStore/ (structured metadata in task creation)
  - apps/web/src/stores/deliverablesStore.ts (state updates from conversation results)
  - Update frontend UI to send appropriate metadata based on active context
- Rollout/feature flags:
  - Direct deployment through existing A2A agent system, no new services or registrations needed

## 7. Risks & Mitigations
- Accidental deletion of important versions → Conversational confirmation + agent prevents current version deletion
- LLM merge produces unexpected results → Agent returns conflict summary in conversation, allows user review
- Performance issues with large content merges → No constraints for v1, monitor agent response times
- Data corruption during merge operations → Agent validates all input versions exist before processing
- User requests scope creep in task-based creation → Agent uses strict prompt engineering to limit scope
- Intent recognition failures → Agent asks for clarification when version management commands are ambiguous

## 8. Test & Verification
- Unit tests for A2A method handlers (delete validation, merge logic, task processing)
- Integration tests for agent conversation flows with various version management scenarios
- E2E tests covering: conversational delete non-current version, attempt to delete current version (agent refuses), create version from conversational task, merge versions through conversation
- Manual testing: Conversation UI interactions, agent responses, error handling, edge cases
- Load testing for agent processing with large content merges

## 9. Work Plan Hints (for Taskmaster)
- Milestones/epics:
  - M1: Service Extension — Add deleteVersion and mergeVersions methods to existing DeliverableVersionsService
  - M2: Metadata Routing — Extend A2AAgentBaseService with structured metadata routing (context + method)
  - M3: Frontend Context System — Add UI state management for active context (conversation/deliverable/project)
  - M4: Version Operations — Implement delete, newVersion, and merge operations with metadata-driven routing
  - M5: UI Integration — Update conversation display to work with contextual operations
  - M6: Error Handling — Add comprehensive error handling and conversational feedback
- Suggested task seeds:
  - Add deleteVersion and mergeVersions methods to DeliverableVersionsService
  - Implement metadata-driven routing in A2AAgentBaseService executeTask() method
  - Create frontend context state management system for conversation/deliverable/project modes
  - Implement context-aware prompt input component that moves between panes
  - Add version deletion with metadata: { context: "deliverable", method: "delete", versionIds: [...] }
  - Implement new version creation with metadata: { context: "deliverable", method: "newVersion", deliverableId: "id", prompt: "..." }
  - Add version merging with metadata: { context: "deliverable", method: "merge", deliverableId: "id", versionIds: [...], prompt: "..." }
  - Enable new deliverable creation from list with agent selection: { context: "deliverable", method: "create", agentType: "...", prompt: "..." }
  - Update frontend task creation to send appropriate metadata based on active context
  - Integrate conversation display with deliverable/project operation results
  - Add comprehensive error handling and conversational user feedback

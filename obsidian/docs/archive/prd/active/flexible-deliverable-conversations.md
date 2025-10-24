---
slug: flexible-deliverable-conversations
title: Implement Flexible Deliverable-Conversation Relationships
owner: golfergeek
reviewers: []
created: 2025-01-20
target-window: 2025-01-20 .. 2025-01-20
success-metrics:
  - Users can edit standalone deliverables by auto-creating conversations (100% success rate)
  - Deliverables survive conversation deletion (0 data loss incidents)
  - Split-view workspace supports both conversation→deliverable and deliverable→conversation flows
  - Existing deliverable evaluations continue to work without modification
risk-level: medium
deps: []
non-goals:
  - Advanced deliverable versioning UI (separate initiative)
  - Deliverable collaboration features
  - Performance optimization of existing flows
---

## 1. Summary
Implement a flexible relationship system between deliverables and conversations where deliverables can exist independently, be linked to conversations on-demand, and survive conversation deletion. This enables both conversation-first and deliverable-first workflows with seamless transitions between contexts while preserving deliverable ownership and agent associations.

## 2. Problem & Goals
- Problem: Current system tightly couples deliverables to conversations with CASCADE deletion, preventing flexible workflows where deliverables should survive conversation cleanup or exist independently
- Goals:
  - Enable deliverables to exist without conversations (standalone mode)
  - Allow on-demand conversation creation for editing standalone deliverables
  - Preserve deliverables when conversations are deleted
  - Support bidirectional workflow initiation (conversation→deliverable, deliverable→conversation)
  - Maintain deliverable ownership and agent associations

## 3. Scope
- In scope:
  - Database schema changes for flexible foreign key constraints (SET NULL instead of CASCADE)
  - Add agent_name field to deliverables table for agent association
  - Backend API for creating editing conversations from deliverables
  - Frontend split-view workspace with conversation pane remaining current size
  - UI components for standalone deliverable management with edit actions
  - Agent context setup for deliverable editing tasks
  - Database migration for schema changes
- Out of scope:
  - Data migration of existing deliverables (handled by migration)
  - Advanced deliverable collaboration features
  - Resizable pane UI (conversation pane stays current size)
  - Performance optimization of existing evaluation system

## 4. Deliverables (Definition of Done)
- User-visible deliverables:
  - Standalone deliverable view with "Edit This", "Enhance This", "Create New Version" actions
  - Split-view workspace showing deliverable (main) + conversation (current size) simultaneously
  - Seamless transition from deliverable editing to conversation with agent context
  - Error display when conversation creation fails (no fallbacks)
- Internal deliverables:
  - Database migration changing conversation_id FK from CASCADE to SET NULL
  - Database migration adding agent_name field to deliverables
  - Backend API endpoints for deliverable-conversation management
  - Frontend store methods for conversation creation from deliverables
- Acceptance criteria:
  - User can view standalone deliverable (conversation_id = NULL) without errors
  - Clicking edit action on standalone deliverable creates conversation with appropriate agent
  - Edit action opens split view with deliverable (main pane) + conversation (sidebar)
  - Deleting conversation sets deliverable.conversation_id to NULL, deliverable remains accessible
  - Agent context is properly set when editing existing deliverables
  - Deliverable owner is preserved from original conversation user
  - Existing deliverable evaluations continue to function unchanged

## 5. Constraints & Assumptions
- Constraints: Must maintain backward compatibility with existing conversation-deliverable workflows, database changes must be non-breaking, conversation pane keeps current dimensions
- Assumptions: Current deliverable versioning system is stable, agents can handle editing context prompts with deliverable history, users understand standalone deliverable concept, existing evaluation system works independently of conversation state

## 6. Technical Plan
- Architecture:
  - Deliverables become independent entities that can optionally reference conversations
  - Conversations can be created on-demand for deliverable editing
  - Split-view UI with deliverable as primary pane, conversation as secondary
- Data model changes:
  - `deliverables.conversation_id`: Change FK constraint from CASCADE to SET NULL
  - `deliverables.agent_name`: Add VARCHAR field to store associated agent
  - Migration to handle existing data safely
- APIs/contracts:
  - `POST /deliverables/{id}/conversations` - Create editing conversation
  - `GET /deliverables?standalone=true` - Get deliverables without conversations
  - Enhanced deliverable response to include agent_name
- Services/modules to touch:
  - `deliverables.service.ts` - Add conversation creation methods
  - `agent-conversations.service.ts` - Update deletion to not cascade
  - `deliverablesStore.ts` - Add editing conversation creation
  - New `DeliverableStandaloneView.vue` component
  - Enhanced workspace routing for split-view
- Rollout/feature flags:
  - No feature flags needed, changes are backward compatible

## 7. Risks & Mitigations
- Risk: Migration fails on existing data → Mitigation: Test migration on copy first, implement rollback plan
- Risk: Conversation creation fails during editing → Mitigation: Show clear error message, no fallback (user can retry)
- Risk: UI confusion between standalone and conversation-linked deliverables → Mitigation: Clear visual indicators and context-appropriate actions
- Risk: Agent context not properly set for editing → Mitigation: Comprehensive testing of agent prompt generation with deliverable history

## 8. Test & Verification
- Unit tests:
  - Database constraint changes work correctly
  - Conversation creation from deliverables
  - Agent context generation for editing
- Integration tests:
  - Full flow: standalone deliverable → edit → conversation creation → split view
  - Conversation deletion leaves deliverable intact
  - Existing conversation→deliverable flow unchanged
- Manual test plan:
  - Create deliverable via conversation, delete conversation, verify deliverable survives
  - Edit standalone deliverable, verify conversation opens with correct agent and context
  - Test all edit action types (enhance, revise, new version, discuss)
- Success metrics measurement:
  - Monitor conversation creation success rate from deliverables
  - Track deliverable survival rate after conversation deletion
  - Verify evaluation system continues working

## 9. Work Plan Hints (for Taskmaster)
- Milestones/epics:
  - M1: Database Schema Changes — Update FK constraints and add agent_name field
  - M2: Backend API Implementation — Add deliverable-conversation management endpoints
  - M3: Frontend Store & Services — Implement conversation creation from deliverables
  - M4: UI Components — Build standalone deliverable view and edit actions
  - M5: Split-View Integration — Connect deliverable editing to workspace split view
- Suggested task seeds:
  - Create database migration for flexible deliverable relationships
  - Add agent_name field to deliverables table and entity
  - Implement createEditingConversation API endpoint
  - Build DeliverableStandaloneView component with edit actions
  - Add deliverablesStore methods for conversation creation
  - Update workspace routing for deliverable+conversation split view
  - Add error handling for failed conversation creation
  - Test conversation deletion preserves deliverables

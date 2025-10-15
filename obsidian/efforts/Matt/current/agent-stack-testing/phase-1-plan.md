# Phase 1 Plan: Context Agent (Blog Post Writer) - Converse & Plan

**Project**: Agent Stack Progressive Testing
**Phase**: 1 of 7
**Created**: 2025-10-14
**Status**: Not Started

---

## Overview

This plan executes Phase 1 testing: validating the complete Context Agent workflow from conversation through plan creation. We'll configure the Blog Post Writer agent, test conversational interaction, verify "Plan" and "Build" buttons, and validate plan CRUD operations.

---

## Environment Setup

**Before Starting**:
- [ ] Web server running on localhost:7102
- [ ] API server running on localhost:7100
- [ ] Database accessible at localhost:7012
- [ ] Playwright configured for browser automation
- [ ] Test tracking document created (`test-progress.md`)

**Console Access**:
- Web server bash_id: (record here when started)
- API server bash_id: (record here when started)

---

## Development Tasks

### Task 1: Configure Blog Post Writer Agent
**Description**: Use role-agent-adder to create properly configured Context Agent

**Subtasks**:
- [ ] Internalize role-agent-adder
- [ ] Run interactive questionnaire
- [ ] Configure agent with these settings:
  - Name: "Blog Post Writer"
  - Slug: "blog-post-writer"
  - Type: context
  - Organization: demo
  - LLM: Anthropic Claude 3.5 Sonnet
  - Modes: converse, plan, build
  - Plan structure: title, outline, target_audience, tone, word_count
- [ ] Verify agent created in database
- [ ] Test agent appears in agent list API endpoint

**Dependencies**: None

**Deliverables**: Blog Post Writer agent fully configured and available

**Notes**:
- Use role-agent-adder for proper configuration
- Ensure all required fields present
- Document any issues encountered

---

### Task 2: Verify Conversation Endpoints
**Description**: Ensure conversation API endpoints exist and work

**Subtasks**:
- [ ] Check `POST /api/conversations/create` endpoint exists
- [ ] Check `POST /api/conversations/{id}/message` endpoint exists
- [ ] Check `GET /api/conversations/{id}` endpoint exists
- [ ] Test creating a conversation via curl/Postman
- [ ] Test sending a message to conversation
- [ ] Verify database tables (conversations, messages) exist

**Dependencies**: Task 1

**Deliverables**: Conversation endpoints validated

**Notes**:
- If endpoints missing, note as blocker
- Check API console for errors
- Verify database schema matches Phase 1 requirements

---

### Task 3: Verify Plan Endpoints
**Description**: Ensure plan API endpoints exist and work

**Subtasks**:
- [ ] Check `POST /api/plans/create` endpoint exists
- [ ] Check `PUT /api/plans/{id}/update` endpoint exists
- [ ] Check `POST /api/plans/{id}/merge` endpoint exists
- [ ] Check `GET /api/plans/{id}` endpoint exists
- [ ] Check `DELETE /api/plans/{id}` endpoint exists
- [ ] Test creating a plan via curl/Postman
- [ ] Verify database table (plans) exists with conversation_id field

**Dependencies**: Task 1

**Deliverables**: Plan endpoints validated

**Notes**:
- Plans table should have conversation_id foreign key
- Check for proper indexes on conversation_id

---

### Task 4: Verify Conversation UI Exists
**Description**: Ensure UI has conversation interface

**Subtasks**:
- [ ] Navigate to conversation interface at localhost:7102
- [ ] Verify can select Blog Post Writer agent
- [ ] Verify message input field exists
- [ ] Verify conversation history displays
- [ ] Check browser console for errors
- [ ] Verify UI components load without crashes

**Dependencies**: Tasks 1, 2

**Deliverables**: Conversation UI confirmed working

**Notes**:
- If UI missing, note as blocker
- Check web server console for build errors
- Verify API integration working

---

### Task 5: Add "Plan" and "Build" Buttons to Agent Responses
**Description**: Implement action buttons under each agent response

**Subtasks**:
- [ ] Locate agent response component in UI code
- [ ] Add "Plan" button component under responses
- [ ] Add "Build" button component under responses
- [ ] Wire up click handlers for both buttons
- [ ] Style buttons consistently
- [ ] Test buttons render correctly in browser
- [ ] Verify hot reload updates UI

**Dependencies**: Task 4

**Deliverables**: Action buttons visible and clickable under agent responses

**Notes**:
- Buttons should appear after agent response renders
- Click handlers can be placeholders initially
- Will wire full functionality in subsequent tests

---

### Task 6: Implement Mode Transition (Converse → Plan)
**Description**: Wire "Plan" button to create plan from conversation

**Subtasks**:
- [ ] Create API endpoint `POST /api/conversations/{id}/transition-to-plan`
- [ ] Implement logic to analyze conversation context
- [ ] Generate structured plan from conversation
- [ ] Store plan with conversation_id reference
- [ ] Return plan ID to frontend
- [ ] Update UI to transition to plan view
- [ ] Test mode transition flow

**Dependencies**: Tasks 1, 2, 3, 5

**Deliverables**: "Plan" button creates plan and transitions UI

**Notes**:
- Plan should contain relevant content from conversation
- UI should smoothly transition between views
- Preserve conversation history when switching views

---

### Task 7: Implement Plan View Navigation
**Description**: Enable navigation between conversation and plan views

**Subtasks**:
- [ ] Create plan detail view component
- [ ] Add navigation to return to conversation from plan
- [ ] Add navigation to view plan from conversation
- [ ] Implement state management for view switching
- [ ] Test bidirectional navigation
- [ ] Verify no data loss during navigation

**Dependencies**: Task 6

**Deliverables**: Smooth navigation between converse and plan modes

**Notes**:
- Both views should maintain their state
- URL routing may be helpful here
- Check browser console during navigation

---

### Task 8: Implement Plan Update Functionality
**Description**: Enable editing plans via UI or API

**Subtasks**:
- [ ] Create plan edit UI component
- [ ] Wire update button/action
- [ ] Connect to `PUT /api/plans/{id}/update` endpoint
- [ ] Test updating plan content
- [ ] Verify UI reflects changes immediately
- [ ] Check database updates correctly

**Dependencies**: Task 7

**Deliverables**: Plan update functionality working

**Notes**:
- Hot reload should show changes immediately
- Timestamp should update on modification

---

### Task 9: Implement Plan Merge Functionality
**Description**: Enable merging changes into existing plan

**Subtasks**:
- [ ] Implement `POST /api/plans/{id}/merge` endpoint logic
- [ ] Define merge strategy (append, smart merge, etc.)
- [ ] Test merging new content into plan
- [ ] Verify no data loss during merge
- [ ] Handle conflict resolution if needed

**Dependencies**: Task 8

**Deliverables**: Plan merge working correctly

**Notes**:
- Merge strategy should be documented
- Consider edge cases (empty plan, conflicting changes)

---

### Task 10: Implement Plan Delete Functionality
**Description**: Enable deleting plans

**Subtasks**:
- [ ] Wire delete action in UI
- [ ] Connect to `DELETE /api/plans/{id}` endpoint
- [ ] Implement soft delete or hard delete (decide with GolferGeek)
- [ ] Handle navigation after delete (return to conversation?)
- [ ] Verify plan removed from database or marked deleted
- [ ] Check conversation history preserved

**Dependencies**: Task 7

**Deliverables**: Plan deletion working

**Notes**:
- Decide: soft delete vs hard delete
- Should conversation history be preserved?
- What happens to orphaned plans?

---

## Testing Tasks

### Test 1: Start Conversation (Converse Mode)
**Description**: User initiates conversation with Context Agent

**Pre-conditions**:
- [ ] Environment setup complete
- [ ] Blog Post Writer agent configured
- [ ] Web and API servers running

**Test Steps**:
1. Navigate to conversation interface
2. Select Blog Post Writer agent
3. Send message: "I want to write a blog post about AI agent patterns"
4. Verify agent responds
5. Verify "Plan" and "Build" buttons appear under response

**Success Criteria**:
- [ ] Conversation interface loads correctly
- [ ] User message sends successfully
- [ ] Agent response appears in conversation thread
- [ ] Response content is relevant and well-formatted
- [ ] "Plan" button visible and clickable under response
- [ ] "Build" button visible and clickable under response
- [ ] API console shows conversation request/response
- [ ] Browser console has no errors
- [ ] Conversation persists in database

**Dependencies**: Tasks 1-5

**Notes**:
- Record conversation ID for later tests
- Check all three consoles (web, API, browser)
- Document any issues in test-progress.md

---

### Test 2: Converse Back-and-Forth
**Description**: Multi-turn conversation to refine blog post requirements

**Pre-conditions**:
- [ ] Test 1 completed successfully
- [ ] Conversation ID from Test 1

**Test Steps**:
1. Send follow-up: "Focus on orchestration patterns specifically"
2. Verify agent responds with refined ideas
3. Check "Plan" and "Build" buttons on new response
4. Send: "Include real-world examples"
5. Verify agent incorporates examples
6. Check buttons appear on each response

**Success Criteria**:
- [ ] Multi-turn conversation flows naturally
- [ ] Agent maintains context across messages
- [ ] Each agent response has "Plan" and "Build" buttons
- [ ] Conversation history displays correctly in UI
- [ ] All messages persist in database
- [ ] API console shows each request/response
- [ ] Browser console has no errors

**Dependencies**: Test 1, Tasks 1-5

**Notes**:
- Test context retention across multiple turns
- Verify conversation history renders correctly

---

### Test 3: Transition to Plan Mode (Create Plan)
**Description**: User clicks "Plan" button to create structured plan

**Pre-conditions**:
- [ ] Test 2 completed with conversation history
- [ ] Agent response with "Plan" button visible

**Test Steps**:
1. Click "Plan" button under agent response
2. Verify API request sent to transition endpoint
3. Wait for plan creation
4. Verify UI transitions to plan view
5. Check plan content reflects conversation context
6. Verify plan has title, sections, outline

**Success Criteria**:
- [ ] "Plan" button click triggers API request
- [ ] API returns 201 Created with valid plan ID
- [ ] Plan stored in database with correct structure
- [ ] Plan references originating conversation (conversation_id set)
- [ ] UI switches to plan view (mode transition)
- [ ] Plan content reflects conversation context
- [ ] Plan visible with title, sections, outline
- [ ] API console shows plan creation log
- [ ] Browser console has no errors

**Dependencies**: Test 2, Tasks 1-6

**Notes**:
- Record plan ID for later tests
- Verify conversation_id foreign key set correctly

---

### Test 4: View and Navigate Between Converse and Plan
**Description**: User can navigate between conversation and plan views

**Pre-conditions**:
- [ ] Test 3 completed with plan created
- [ ] Plan ID known

**Test Steps**:
1. From plan view, click navigation to return to conversation
2. Verify conversation history still visible
3. Navigate back to plan view
4. Verify plan still renders correctly
5. Check both views maintain state

**Success Criteria**:
- [ ] Navigation between views works smoothly
- [ ] Conversation history persists when returning
- [ ] Plan content persists when returning
- [ ] UI indicates current mode (Converse vs Plan)
- [ ] No data loss during navigation
- [ ] Browser console has no errors

**Dependencies**: Test 3, Task 7

**Notes**:
- Test multiple back-and-forth navigations
- Check for memory leaks or performance issues

---

### Test 5: Update Plan
**Description**: User or agent updates existing plan's content

**Pre-conditions**:
- [ ] Test 3 completed with plan created
- [ ] Plan ID known

**Test Steps**:
1. From plan view, modify plan content (e.g., change title)
2. Save changes
3. Verify API sends PUT request
4. Check UI updates immediately
5. Verify database reflects changes

**Success Criteria**:
- [ ] API returns 200 OK with updated plan
- [ ] Database reflects changes
- [ ] UI shows updated content immediately (hot reload)
- [ ] API console shows successful update log
- [ ] Browser console has no errors
- [ ] Version/timestamp updated appropriately

**Dependencies**: Test 4, Task 8

**Notes**:
- Test multiple update operations
- Verify updated_at timestamp changes

---

### Test 6: Merge Plan
**Description**: Agent merges changes into existing plan

**Pre-conditions**:
- [ ] Test 5 completed
- [ ] Plan with some content exists

**Test Steps**:
1. Continue conversation with refinements
2. Trigger merge operation (via API or UI)
3. Verify agent sends POST request to merge endpoint
4. Check merged content appears in plan
5. Verify no data loss

**Success Criteria**:
- [ ] API returns 200 OK with merged plan
- [ ] Merge logic correctly combines changes
- [ ] No data loss during merge
- [ ] UI reflects merged state
- [ ] API console shows merge operation details
- [ ] Browser console has no errors

**Dependencies**: Test 5, Task 9

**Notes**:
- Document merge strategy used
- Test edge cases (empty sections, conflicts)

---

### Test 7: Delete Plan
**Description**: User or agent deletes a plan

**Pre-conditions**:
- [ ] Test 6 completed
- [ ] Plan ID known

**Test Steps**:
1. From plan view, trigger delete action
2. Confirm deletion if prompted
3. Verify API sends DELETE request
4. Check UI navigates away from deleted plan
5. Verify plan no longer in plans list
6. Check conversation history still accessible

**Success Criteria**:
- [ ] API returns 200 OK or 204 No Content
- [ ] Plan removed from database (or marked deleted)
- [ ] Plan no longer visible in UI
- [ ] Conversation history preserved (if soft delete)
- [ ] API console shows deletion log
- [ ] Browser console has no errors

**Dependencies**: Test 6, Task 10

**Notes**:
- Document whether soft or hard delete used
- Verify conversation still accessible after plan delete

---

### Test 8: Build Button Presence
**Description**: Verify "Build" button appears and is functional

**Pre-conditions**:
- [ ] Test 1 completed with active conversation
- [ ] Test 3 completed with plan created

**Test Steps**:
1. View conversation thread with agent responses
2. Verify "Build" button appears alongside "Plan" button
3. Click "Build" button (may be placeholder for Phase 5)
4. From plan view, check if "Build" action available
5. Verify button state indicates availability

**Success Criteria**:
- [ ] "Build" button visible in conversation view under agent responses
- [ ] "Build" button styled consistently with "Plan" button
- [ ] Button click triggers expected action (even if placeholder)
- [ ] Button state indicates availability/readiness
- [ ] UI provides feedback on button interaction

**Dependencies**: Tests 1, 3

**Notes**:
- Full build functionality tested in Phase 5
- This test just validates button presence and clickability

---

## Progress Tracking

### Completed Tasks
- None yet

### Current Task
- Not started

### Blocked Items
- None

### Notes and Decisions
- (Record decisions made during implementation)
- (Track any deviations from original plan)
- (Document issues and resolutions)

---

## Success Criteria

**Phase 1 Complete When**:
- [ ] All 10 development tasks completed
- [ ] All 8 tests passing
- [ ] No errors in API console
- [ ] No errors in browser console
- [ ] No errors in web server console
- [ ] Conversations persist correctly in database
- [ ] Plans persist correctly in database with conversation references
- [ ] Mode transitions work seamlessly
- [ ] "Plan" and "Build" buttons render correctly
- [ ] Test results documented in `test-progress.md`

---

## Context Notes

**Purpose**: Track state across sessions and context switches

**Last Update**: 2025-10-14
**Current State**: Plan created, not yet started
**Next Steps**:
1. Set up environment (servers, database, Playwright)
2. Start with Task 1: Configure Blog Post Writer agent using role-agent-adder
3. Proceed through development tasks sequentially
4. Execute tests as development tasks complete

**Open Questions**:
1. Should conversations have a title field, or generate one from first message?
2. Should plan updates create a version history, or just overwrite?
3. What should merge conflict resolution strategy be?
4. Should delete be soft delete (mark deleted) or hard delete (remove record)?
5. Should deleted plans be recoverable?
6. Should "Build" button be disabled/hidden until plan is created, or always available?
7. When user clicks "Build" from conversation (before plan exists), should it auto-create plan first?
8. Should conversation history be preserved when transitioning to plan mode?

**Answers** (to be filled in during execution):
1.
2.
3.
4.
5.
6.
7.
8.

---

## Quick Reference

### Environment Ports
- Web: http://localhost:7102
- API: http://localhost:7100
- Database: localhost:7012

### Key Endpoints
- Conversations: `/api/conversations/*`
- Plans: `/api/plans/*`
- Mode transition: `/api/conversations/{id}/transition-to-plan`

### Console Commands
- Check web server: `BashOutput(bash_id: "...")`
- Check API server: `BashOutput(bash_id: "...")`

### Database Tables
- `agents` - Agent configurations
- `conversations` - Conversation records
- `messages` - Conversation messages
- `plans` - Plan records (with conversation_id)

---

**Next Step**: Begin environment setup, then proceed to Task 1.

# Phase 1: Context Agent (Blog Post Writer) - Converse & Plan

**Project**: Agent Stack Progressive Testing
**Phase**: 1 of 7
**Created**: 2025-10-14
**Status**: Draft

---

## Overview

This phase validates the complete Context Agent workflow: **Converse → Plan → Build workflow**. Starting with conversational interaction (Converse mode), then transitioning to structured planning (Plan mode), and finally preparing for build execution. The Context Agent (Blog Post Writer) is the simplest agent type, making it ideal for establishing baseline functionality.

**Key Flow**: User converses with agent → Agent response shows "Plan" and "Build" buttons → User clicks "Plan" → Agent creates structured plan → Plan displayed with CRUD operations available.

---

## Objectives

1. Verify Context Agent can engage in conversational interaction (Converse mode)
2. Validate that agent responses render with "Plan" and "Build" action buttons
3. Test transition from Converse to Plan mode (creating structured plan)
4. Validate plan CRUD operations (update, merge, view, delete)
5. Confirm UI correctly displays conversation, plan state, and mode transitions

---

## Detailed Requirements

### Test 1: Start Conversation (Converse Mode)
**Description**: User initiates conversation with Context Agent about blog post topic

**Pre-conditions**:
- API server running on localhost:7100
- Web server running on localhost:7102
- Database clean or in known state
- Context Agent (Blog Post Writer) configured and available

**Test Steps**:
1. User navigates to agent conversation interface
2. User sends message: "I want to write a blog post about AI agent patterns"
3. Agent processes message and responds with blog post ideas/suggestions
4. Agent response appears in UI with text content
5. Verify "Plan" and "Build" buttons appear under agent response

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

**Dependencies**: None

---

### Test 2: Converse Back-and-Forth
**Description**: Multi-turn conversation to refine blog post requirements

**Pre-conditions**:
- Test 1 completed with active conversation

**Test Steps**:
1. User sends follow-up: "Focus on orchestration patterns specifically"
2. Agent responds with refined ideas about orchestration
3. Verify response has "Plan" and "Build" buttons
4. User sends: "Include real-world examples"
5. Agent incorporates examples into response
6. Verify each response has action buttons

**Success Criteria**:
- [ ] Multi-turn conversation flows naturally
- [ ] Agent maintains context across messages
- [ ] Each agent response has "Plan" and "Build" buttons
- [ ] Conversation history displays correctly in UI
- [ ] All messages persist in database
- [ ] API console shows each request/response
- [ ] Browser console has no errors

**Dependencies**: Test 1

---

### Test 3: Transition to Plan Mode (Create Plan)
**Description**: User clicks "Plan" button to create structured plan from conversation

**Pre-conditions**:
- Tests 1-2 completed with conversation history
- Agent response with "Plan" button visible

**Test Steps**:
1. User clicks "Plan" button under agent response
2. API receives transition request with conversation context
3. Agent analyzes conversation and creates structured blog post plan
4. API stores plan in database with reference to conversation
5. UI transitions to plan view showing structured plan
6. Verify plan contains sections, outline, key points from conversation

**Success Criteria**:
- [ ] "Plan" button click triggers API request
- [ ] API returns 201 Created with valid plan ID
- [ ] Plan stored in database with correct structure
- [ ] Plan references originating conversation
- [ ] UI switches to plan view (mode transition)
- [ ] Plan content reflects conversation context
- [ ] Plan visible with title, sections, outline
- [ ] API console shows plan creation log
- [ ] Browser console has no errors

**Dependencies**: Tests 1-2

---

### Test 4: View and Navigate Between Converse and Plan
**Description**: User can navigate between conversation and plan views

**Pre-conditions**:
- Plan created from conversation in Test 3

**Test Steps**:
1. From plan view, navigate back to conversation
2. Verify conversation history still visible
3. Navigate back to plan view
4. Verify plan still renders correctly
5. Check that both views maintain state

**Success Criteria**:
- [ ] Navigation between views works smoothly
- [ ] Conversation history persists when returning
- [ ] Plan content persists when returning
- [ ] UI indicates current mode (Converse vs Plan)
- [ ] No data loss during navigation
- [ ] Browser console has no errors

**Dependencies**: Test 3

---

### Test 5: Update Plan
**Description**: User or agent updates existing plan's content

**Pre-conditions**:
- Plan from Test 3 exists in database
- Plan ID is known

**Test Steps**:
1. From plan view, user modifies content or agent updates via API
2. API sends PUT request to `/api/plans/{id}/update` with modified content
3. API processes update and modifies database record
4. API returns updated plan
5. UI updates to show modified content

**Success Criteria**:
- [ ] API returns 200 OK with updated plan
- [ ] Database reflects changes
- [ ] UI shows updated content immediately (hot reload)
- [ ] API console shows successful update log
- [ ] Browser console has no errors
- [ ] Version/timestamp updated appropriately

**Dependencies**: Tests 1-4

---

### Test 6: Merge Plan
**Description**: Agent merges changes into existing plan (collaborative editing scenario)

**Pre-conditions**:
- Plan from Test 3 exists
- Agent has additional changes to merge based on new conversation

**Test Steps**:
1. User continues conversation with refinements
2. Agent sends POST request to `/api/plans/{id}/merge` with delta/changes
3. API merges changes with existing plan content
4. API resolves any conflicts (if applicable)
5. API returns merged plan
6. UI shows merged result

**Success Criteria**:
- [ ] API returns 200 OK with merged plan
- [ ] Merge logic correctly combines changes
- [ ] No data loss during merge
- [ ] UI reflects merged state
- [ ] API console shows merge operation details
- [ ] Browser console has no errors

**Dependencies**: Tests 1-5

---

### Test 7: Delete Plan
**Description**: User or agent deletes a plan

**Pre-conditions**:
- Plan exists from previous tests
- Plan ID is known

**Test Steps**:
1. From plan view, trigger delete action
2. API sends DELETE request to `/api/plans/{id}`
3. API removes plan from database (or marks as deleted)
4. API returns success confirmation
5. UI navigates away from deleted plan
6. Verify plan no longer appears in plans list

**Success Criteria**:
- [ ] API returns 200 OK or 204 No Content
- [ ] Plan removed from database (or marked deleted)
- [ ] Plan no longer visible in UI
- [ ] Conversation history preserved (if soft delete)
- [ ] API console shows deletion log
- [ ] Browser console has no errors

**Dependencies**: Tests 1-6

---

### Test 8: Build Button Presence (Preparation for Phase 5)
**Description**: Verify "Build" button appears and is functional (will be tested fully in Phase 5)

**Pre-conditions**:
- Active conversation with agent responses
- Plan exists from Test 3

**Test Steps**:
1. View conversation thread with agent responses
2. Verify "Build" button appears under each agent response alongside "Plan" button
3. Verify "Build" button is clickable (implementation tested in Phase 5)
4. From plan view, verify if "Build" action is available

**Success Criteria**:
- [ ] "Build" button visible in conversation view under agent responses
- [ ] "Build" button styled consistently with "Plan" button
- [ ] Button click triggers expected action (even if placeholder for now)
- [ ] Button state indicates availability/readiness
- [ ] UI provides feedback on button interaction

**Dependencies**: Tests 1-3

---

## Technical Approach

### API Endpoints to Test

**Conversation Endpoints**:
- `POST /api/conversations/create` - Start new conversation
- `POST /api/conversations/{id}/message` - Send message to agent
- `GET /api/conversations/{id}` - Get conversation history
- `GET /api/conversations` - List all conversations

**Plan Endpoints**:
- `POST /api/plans/create` - Create new plan (from conversation)
- `PUT /api/plans/{id}/update` - Update existing plan
- `POST /api/plans/{id}/merge` - Merge changes into plan
- `GET /api/plans` - List all plans
- `GET /api/plans/{id}` - Get single plan
- `DELETE /api/plans/{id}` - Delete plan

**Mode Transition**:
- `POST /api/conversations/{id}/transition-to-plan` - Convert conversation to structured plan

### Context Agent Configuration
The test will use a Context Agent configured as a "Blog Post Writer" with:
- Agent Type: `context`
- Capabilities: Conversation, plan creation, content generation
- Input: Blog post topic/requirements
- Output: Conversational responses, structured blog post plan

### Database Schema

**Conversations Table**:
- `id` (UUID)
- `title` (string, optional)
- `mode` (enum: converse, plan, build)
- `agent_id` (foreign key to agents)
- `organization_slug` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Messages Table**:
- `id` (UUID)
- `conversation_id` (foreign key)
- `role` (enum: user, agent, system)
- `content` (text)
- `created_at` (timestamp)

**Plans Table**:
- `id` (UUID)
- `conversation_id` (foreign key, nullable - links to originating conversation)
- `title` (string)
- `content` (JSON or text)
- `status` (enum: draft, active, completed, deleted)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `agent_id` (foreign key to agents)
- `organization_slug` (string)

---

## Deliverables

1. **Test Results Document**: Phase 1 section of `test-progress.md` with all 8 tests marked passed
2. **Bug Fixes**: Any issues found during testing are fixed
3. **API Validation**:
   - Conversation endpoints working correctly
   - Plan CRUD endpoints working correctly
   - Mode transition (Converse → Plan) working correctly
4. **UI Validation**:
   - Conversation interface with agent responses
   - "Plan" and "Build" buttons render under each response
   - Mode transitions work smoothly
   - Plan view displays correctly

---

## Dependencies

### External Dependencies
- PostgreSQL database running and accessible
- API server with conversation and plan endpoints implemented
- Web UI with conversation interface and plan pages
- Context Agent (Blog Post Writer) configured

### Previous Phases
- None (this is Phase 1)

---

## Success Criteria

**Phase Complete When**:
- ✅ All 8 tests pass completely
- ✅ No errors in API console during test execution
- ✅ No errors in browser console during test execution
- ✅ No errors in web server console during test execution
- ✅ Conversations persist correctly in database
- ✅ Plans persist correctly in database with conversation references
- ✅ Mode transitions (Converse → Plan) work seamlessly
- ✅ "Plan" and "Build" buttons render correctly
- ✅ UI accurately reflects backend state
- ✅ Test results documented in `test-progress.md`

---

## Testing Notes

### Console Monitoring Strategy
- **API Console**: Watch for request logs, SQL queries, error stack traces
- **Browser Console**: Watch for JavaScript errors, network failures, React warnings
- **Web Console**: Watch for HMR updates, build errors, asset loading issues

### Common Issues to Watch For
- CORS errors when API and web are on different ports
- Database connection failures
- Missing or incorrect API endpoints
- WebSocket connection issues for real-time conversation updates
- UI rendering errors with conversation or plan data
- Button click handlers not wired correctly
- Mode transition state management issues
- Conversation context not maintained across messages
- Plan not correctly linked to originating conversation
- Timezone issues with timestamps
- JSON serialization/deserialization errors

### Debugging Approach
1. Reproduce the test failure
2. Check all three consoles for error messages
3. Verify request/response payloads in Network tab
4. Check database state directly if needed
5. Make focused code fix
6. Re-run test to verify fix
7. Document fix in test-progress.md

---

## Open Questions

1. Should conversations have a title field, or generate one from first message?
2. Should plan updates create a version history, or just overwrite?
3. What should merge conflict resolution strategy be?
4. Should delete be soft delete (mark deleted) or hard delete (remove record)?
5. Should deleted plans be recoverable?
6. Should "Build" button be disabled/hidden until plan is created, or always available?
7. When user clicks "Build" from conversation (before plan exists), should it auto-create plan first?
8. Should conversation history be preserved when transitioning to plan mode?

---

## Next Steps

Once this phase is approved, I'll create `phase-1-plan.md` with detailed test execution steps and progress tracking.

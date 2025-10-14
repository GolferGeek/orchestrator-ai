# Phase 8: Frontend-Backend Integration Testing

**Status**: 🟡 Not Started
**Assignee**: Claude (Test Lead)
**Duration**: 6-8 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 7 Complete

---

## Objective

Test complete end-to-end workflows with real UI interacting with backend APIs. Verify all three modes work seamlessly together through the UI.

---

## Testing Tasks

### Test 1: E2E - Complete Workflow Through UI
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Full Talk → Plan → Build workflow using actual UI

**Test Steps**:
1. Open browser to http://localhost:3000
2. Select blog-post-writer agent
3. Click Talk button
4. Type: "I want to write about microservices architecture"
5. Send message
6. Verify conversation response appears
7. Click Plan button
8. Type: "Create a plan for this blog post"
9. Send message
10. Verify plan created and displayed
11. Click Build button
12. Type: "Generate the blog post"
13. Send message
14. Verify deliverable created and displayed

**Expected Results**:
- Smooth flow through all three modes
- All API calls succeed
- UI updates in real-time
- Data persists correctly
- No errors in console

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: E2E - Keyboard Shortcuts Workflow
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Complete workflow using only keyboard shortcuts

**Test Steps**:
1. Type message
2. Press Ctrl+T to send in Talk mode
3. Type message
4. Press Ctrl+P to send in Plan mode
5. Type message
6. Press Ctrl+B to send in Build mode

**Expected Results**:
- All keyboard shortcuts work
- Modes switch correctly
- Messages sent with correct mode

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: E2E - Skip Planning Workflow
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Talk → Build without planning

**Test Steps**:
1. Click Talk button
2. Have conversation
3. Click Build button (skip Plan)
4. Send build request
5. Verify deliverable created from conversation

**Expected Results**:
- Build works without plan
- Uses conversation context
- Deliverable relevant to conversation

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: E2E - Plan Editing Workflow
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Create plan, edit multiple times, then build

**Test Steps**:
1. Create initial plan
2. Edit plan (v2)
3. Edit plan again (v3)
4. Verify all versions shown in UI
5. Build from latest version
6. Verify deliverable uses v3

**Expected Results**:
- Multiple plan versions created
- UI shows version history
- Build uses correct version

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: E2E - Agent Without plan_structure
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test with conversation-only agent

**Test Steps**:
1. Select agent with plan_structure = null
2. Verify Plan button disabled
3. Verify "Conversation Only" badge shown
4. Use Talk mode
5. Use Build mode
6. Verify both work correctly

**Expected Results**:
- Plan button disabled
- Talk and Build fully functional
- Clear indication why Plan unavailable

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 6: E2E - Multiple Conversations
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test switching between conversations maintains state

**Test Steps**:
1. Start conversation A in Talk mode
2. Create plan in conversation A
3. Start conversation B in Talk mode
4. Switch back to conversation A
5. Verify plan still there
6. Verify in Talk mode (mode persists)

**Expected Results**:
- Each conversation maintains own state
- Mode persists per conversation
- Plans/deliverables don't mix

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 7: E2E - Error Handling in UI
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test UI error handling

**Test Steps**:
1. Stop API server
2. Try to send message
3. Verify error shown in UI
4. Restart API server
5. Retry message
6. Verify recovery works

**Expected Results**:
- Clear error message shown
- UI doesn't crash
- Retry works after recovery

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 8: E2E - Loading States
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify loading indicators work

**Test Steps**:
1. Send Talk message
2. Verify "Agent is typing..." shown
3. Send Plan message
4. Verify "Creating plan..." shown
5. Send Build message
6. Verify "Building deliverable..." shown with cancel button

**Expected Results**:
- Appropriate loading state for each mode
- Cancel button works for Build
- UI disabled during processing

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 9: E2E - Real-time Updates
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test mode indicator updates in real-time

**Test Steps**:
1. Watch chat header while switching modes
2. Watch mode indicator during message send
3. Verify real-time updates
4. Check for any UI lag or flicker

**Expected Results**:
- Instant updates
- No lag or flicker
- Smooth transitions

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 10: Cross-Browser Testing
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test in different browsers

**Browsers to Test**:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge

**Expected Results**:
- Works in all browsers
- Keyboard shortcuts work
- UI renders correctly
- No browser-specific bugs

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 11: Mobile Responsiveness
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test on mobile viewport

**Test Steps**:
1. Resize browser to mobile width (375px)
2. Test all three modes
3. Verify buttons accessible
4. Verify layout doesn't break

**Expected Results**:
- UI responsive on mobile
- All features accessible
- No layout issues

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Performance Testing

### Test 12: Performance - Response Times
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Measure UI response times

**Metrics to Measure**:
- Time from click to mode switch: ___ ms
- Time from send to response displayed: ___ ms
- Plan creation time: ___ ms
- Build creation time: ___ ms

**Expected Results**:
- Mode switch: < 50ms
- Message send-receive: < 2s (depends on LLM)
- Plan creation: < 5s
- Build creation: < 10s

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Integration Test Summary

**Total Tests**: 12
**Passed**: 0
**Failed**: 0
**Blocked**: 0

**Issues Found**:


**Performance Notes**:


**Browser Compatibility**:


**Ready for Phase 9**: ⬜ Yes / ⬜ No

---

## Phase 8 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Frontend-Backend Integration**: ⬜ Verified
**Ready for Production**: ⬜ Yes / ⬜ No

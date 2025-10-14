# Effort Type: Front-End Testing

**Purpose**: Define the testing approach for projects where a testing agent validates front-end and API functionality with live console monitoring and browser automation.

---

## Overview

This effort type describes a testing environment where:
- Web and API servers run in separate terminal sessions visible to the testing agent
- The testing agent can monitor real-time console output from both servers
- The testing agent uses Playwright to interact with the browser at a specific endpoint
- The testing agent can modify code and see hot-reload results immediately
- Tests are executed progressively, with each test passing before moving to the next

---

## Environment Setup

### Server Configuration

**Web Server**:
- Runs on: `localhost:7102` (or configurable port)
- Type: Front-end development server with hot reload (e.g., Vite, Next.js, etc.)
- Console Access: Background bash session visible to testing agent
- Auto-reload: Changes to front-end code trigger immediate reload

**API Server**:
- Runs on: `localhost:7100` (or configurable port)
- Type: Backend API server with hot reload (e.g., NestJS, Express, etc.)
- Console Access: Background bash session visible to testing agent
- Auto-reload: Changes to API code trigger immediate reload

**Browser**:
- Access URL: `http://localhost:7102` (matches web server port)
- Automation: Playwright connects to this endpoint
- DevTools: Console, Network, and Application tabs available for inspection

---

## Testing Agent Capabilities

The testing agent has these unique capabilities:

### 1. Console Monitoring
- **Web Console**: Monitor front-end server logs, HMR updates, build warnings
- **API Console**: Monitor API requests, database queries, error logs, responses
- **Browser Console**: Monitor JavaScript errors, network failures, application logs

### 2. Browser Automation
- Use Playwright to navigate pages
- Click buttons, fill forms, trigger UI interactions
- Verify expected elements appear
- Check for error states or success states

### 3. Code Modification
- Edit front-end components and see hot-reload results
- Edit API routes/services and see hot-reload results
- Fix bugs discovered during testing
- Make small, focused changes to pass tests

### 4. Real-Time Verification
- Execute test action
- Monitor all three console sources simultaneously
- Verify expected behavior in UI
- Verify expected logs in API console
- Verify no errors in browser console

---

## Testing Workflow

### Phase 0: Environment Verification and Setup

**FIRST STEP - Check Environment**:

1. **Check Web Server**
   - Is web server running on port 7102?
   - Can you access console output via BashOutput?
   - Test: Navigate browser to `localhost:7102` - does it load?

2. **Check API Server**
   - Is API server running on port 7100?
   - Can you access console output via BashOutput?
   - Test: Make a simple API call - does it respond?

3. **Check Browser Control**
   - Can Playwright connect to `localhost:7102`?
   - Can you navigate and interact with the page?
   - Are DevTools accessible?

**If Environment Is NOT Ready, Set It Up**:

1. **Start API Server** (in background):
   ```bash
   # Navigate to API directory and start server
   cd apps/api && npm run start:dev
   # (or whatever the start command is for this project)
   # Run in background to get bash_id for monitoring
   ```
   - Note the bash_id for API console monitoring

2. **Start Web Server** (in background):
   ```bash
   # Navigate to web directory and start server
   cd apps/web && npm run dev -- --port 7102
   # (or whatever the start command is for this project)
   # Run in background to get bash_id for monitoring
   ```
   - Note the bash_id for web console monitoring

3. **Verify Browser Access**:
   - Use Playwright to navigate to `localhost:7102`
   - Confirm page loads
   - Confirm you can interact with page

4. **Login to Application**:
   - Click the Login button
   - Enter credentials:
     - Email: `demo.user@orchestratorai.io`
     - Password: `DemoUser123!`
   - Submit and verify successful login
   - Confirm you can access authenticated pages

5. **Document Environment**:
   - Record API bash_id in test tracking document
   - Record web bash_id in test tracking document
   - Confirm ports (7100 for API, 7102 for web)

**Only After Environment Is Ready**:
- Review test plan document to understand test phases
- Proceed to Phase 1: Progressive Test Execution

---

### Phase 1: Progressive Test Execution

**For Each Test**:

1. **Understand the Test**
   - Read test description from plan
   - Clarify expected behavior with GolferGeek
   - Identify what "pass" means for this test

2. **Set Up Monitoring**
   - Check web console for current state
   - Check API console for current state
   - Open browser DevTools (Console + Network tabs)

3. **Execute Test**
   - Use Playwright to perform actions (or manual if needed)
   - Observe UI changes in real-time
   - Watch console logs from all sources

4. **Verify Results**
   - UI shows expected changes
   - API logs show successful operations
   - Browser console is clean (no errors)
   - Network requests succeed

5. **Debug Failures** (if needed)
   - Read error messages carefully
   - Check API stack traces
   - Check browser console errors
   - Check network tab for failed requests
   - Identify root cause

6. **Fix Code** (if needed)
   - Make small, focused changes to API or front-end
   - Let hot reload apply changes
   - Re-run test to verify fix

7. **Document Results**
   - Update test tracking document
   - Note any issues found and fixed
   - Mark test as passed

8. **Move to Next Test**
   - Only proceed after current test passes completely
   - Never skip failing tests

---

## Test Plan Structure

When the planner creates a test plan using this effort type, it should include:

### Development Tasks
Tasks for building/fixing features before testing (if applicable)

### Testing Tasks

Each testing task should specify:

```markdown
### Test {N}: {Test Name}

**Objective**: What this test validates

**Pre-conditions**:
- What must be true before running this test
- What data or state is required

**Test Steps**:
1. Navigate to {page/URL}
2. Perform {action} (e.g., click button, fill form)
3. Verify {expected result} in UI
4. Check API console for {expected log pattern}
5. Check browser console for no errors

**Success Criteria**:
- [ ] UI shows {expected state}
- [ ] API logs show {expected pattern}
- [ ] Browser console is clean
- [ ] Network requests succeed

**Dependencies**: Test 1, Test 2 (or None)

**Notes**: (Space for debugging notes, decisions, blockers)
```

---

## Plan Template for This Effort Type

When using front-end-testing effort type, plans should follow this structure:

```markdown
# Test Plan: {Feature/Phase Name}

**Effort Type**: Front-End Testing
**Web Server**: localhost:7102
**API Server**: localhost:7100
**Browser**: Playwright @ localhost:7102

---

## Environment Setup

**Before Starting**:
- [ ] Web server running on 7102
- [ ] API server running on 7100
- [ ] Browser accessible at localhost:7102
- [ ] Playwright configured and tested
- [ ] Test tracking document created

---

## Testing Tasks

### Test 1: {Test Name}
[Structure as described above]

### Test 2: {Test Name}
[Structure as described above]

---

## Progress Tracking

### Completed Tests
- None yet

### Current Test
- Not started

### Blocked Items
- None

### Notes and Decisions
- (Testing agent adds notes here during execution)
- (Records any deviations from expected behavior)
- (Documents fixes applied during testing)

---

## Context Notes

**Last Update**: {date}
**Current State**: {brief summary}
**Next Steps**: {what to do when resuming}
**Open Questions**: {any unresolved questions}
```

---

## Key Principles for This Effort Type

### 1. Progressive Testing
- One test at a time
- Current test must pass before moving to next
- No skipping or "good enough" tests

### 2. Multi-Source Monitoring
- Always watch all three consoles (web, API, browser)
- Root cause analysis requires checking all sources
- Don't just fix UI symptoms, fix underlying issues

### 3. Fast Iteration
- Hot reload enables quick fix-test cycles
- Make small changes and verify immediately
- Don't batch multiple fixes without testing

### 4. Code Modification
- Testing agent can fix bugs found during testing
- Keep changes small and focused on current test
- Don't implement new features, just fix what's broken

### 5. Documentation
- Update test tracking after each test
- Record issues found and how they were fixed
- Maintain context for future sessions

---

## When Planner Uses This Effort Type

When the planner sees "front-end-testing" as the effort type, they should:

1. **Structure the plan** with:
   - Environment setup checklist
   - Progressive test tasks with clear success criteria
   - Progress tracking section
   - Context notes section

2. **Define each test** with:
   - Clear objective
   - Explicit pre-conditions
   - Step-by-step test actions
   - Expected results in UI, API logs, and browser console
   - Dependencies on other tests

3. **Set expectations** that:
   - Testing agent will monitor multiple consoles
   - Testing agent may fix code to make tests pass
   - Testing agent will document findings
   - Tests execute progressively (no parallelization)

4. **Provide context** about:
   - What servers are running and on which ports
   - How to access browser (Playwright endpoint)
   - Where test tracking document lives
   - How to check console outputs

---

## Example Usage

**Planner receives request**: "Create a testing plan for the new user registration flow"

**Planner recognizes**: This is a front-end testing effort

**Planner generates plan**:
- Environment setup with servers on 7102/7100
- Test 1: Verify registration form renders
- Test 2: Test form validation (empty fields)
- Test 3: Test form validation (invalid email)
- Test 4: Test successful registration
- Test 5: Verify redirect after registration
- Each test includes UI checks, API log checks, browser console checks
- Progress tracking and context notes sections included

**Testing agent receives plan**:
- Understands environment (7102/7100, Playwright)
- Knows to monitor all three consoles
- Executes tests progressively
- Documents results and fixes issues
- Updates progress tracking as tests complete

---

## Benefits of This Effort Type

1. **Clear expectations**: Testing agent knows exactly how to approach testing
2. **Consistent structure**: All front-end testing efforts follow same pattern
3. **Reusable**: Works for any front-end + API testing scenario
4. **Context preservation**: Progress tracking maintains state across sessions
5. **Quality focus**: Progressive testing ensures thorough validation

---

## Related Artifacts

**Agent Role**: [role-tester.md](../agent-roles/role-tester.md)
**Example Context**: [temp-agent-stack-testing-context.md](../agent-roles/temp-agent-stack-testing-context.md)

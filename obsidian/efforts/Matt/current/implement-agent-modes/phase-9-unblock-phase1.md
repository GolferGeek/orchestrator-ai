# Phase 9: Unblock Phase 1 Testing

**Status**: 🟡 Not Started
**Assignee**: Claude (Lead)
**Duration**: 4-6 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 8 Complete

---

## Objective

Configure blog-post-writer agent with schemas, update Phase 1 test environment, and execute all 8 Phase 1 tests to verify the agent stack is fully functional.

---

## Setup Tasks

### Task 1: Configure blog-post-writer Agent with Schemas
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Add plan_structure, deliverable_structure, and io_schema to blog-post-writer

**SQL Script**:
```sql
UPDATE public.agents
SET
  plan_structure = '{
    "type": "object",
    "required": ["sections", "target_audience", "keywords"],
    "properties": {
      "sections": {
        "type": "array",
        "minItems": 3,
        "items": {
          "type": "object",
          "required": ["title", "key_points"],
          "properties": {
            "title": {"type": "string", "minLength": 1},
            "key_points": {
              "type": "array",
              "minItems": 2,
              "items": {"type": "string"}
            }
          }
        }
      },
      "target_audience": {
        "type": "string",
        "minLength": 1
      },
      "keywords": {
        "type": "array",
        "minItems": 3,
        "items": {"type": "string"}
      },
      "tone": {
        "type": "string",
        "enum": ["professional", "casual", "technical"]
      }
    }
  }'::jsonb,

  deliverable_structure = '{
    "type": "object",
    "required": ["introduction", "body", "conclusion"],
    "properties": {
      "introduction": {
        "type": "object",
        "required": ["hook", "thesis"],
        "properties": {
          "hook": {"type": "string", "minLength": 50},
          "thesis": {"type": "string", "minLength": 50}
        }
      },
      "body": {
        "type": "array",
        "minItems": 3,
        "items": {
          "type": "object",
          "required": ["section_title", "paragraphs"],
          "properties": {
            "section_title": {"type": "string"},
            "paragraphs": {
              "type": "array",
              "minItems": 2,
              "items": {"type": "string", "minLength": 100}
            }
          }
        }
      },
      "conclusion": {
        "type": "object",
        "required": ["summary", "call_to_action"],
        "properties": {
          "summary": {"type": "string", "minLength": 50},
          "call_to_action": {"type": "string", "minLength": 20}
        }
      }
    }
  }'::jsonb,

  io_schema = '{
    "input": {
      "type": "object",
      "properties": {
        "topic": {"type": "string"},
        "length": {"type": "number", "minimum": 500}
      }
    },
    "output": {
      "type": "object",
      "required": ["content", "metadata"],
      "properties": {
        "content": {
          "type": "string",
          "minLength": 500,
          "description": "The complete blog post in markdown or HTML"
        },
        "metadata": {
          "type": "object",
          "required": ["word_count", "reading_time"],
          "properties": {
            "word_count": {"type": "number", "minimum": 500},
            "reading_time": {"type": "number", "minimum": 2},
            "keywords_used": {
              "type": "array",
              "items": {"type": "string"}
            }
          }
        }
      }
    }
  }'::jsonb

WHERE slug = 'blog-post-writer';
```

**Verification**:
```sql
SELECT
  slug,
  plan_structure IS NOT NULL as has_plan_structure,
  deliverable_structure IS NOT NULL as has_deliverable_structure,
  io_schema IS NOT NULL as has_io_schema
FROM public.agents
WHERE slug = 'blog-post-writer';
```

**Expected Results**:
- All three columns populated
- Agent ready for Phase 1 tests

**Actual Results**:


**Status**: ⬜ Complete

**Notes**:


---

### Task 2: Verify Test Environment
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Ensure all services running and ready

**Checklist**:
- [ ] Database running (local or Supabase)
- [ ] API server running on port 7100
- [ ] Web server running on port 3000
- [ ] Blog post writer agent exists
- [ ] No pending migrations

**Commands**:
```bash
# Check database
psql -h 127.0.0.1 -p 7012 -U postgres -d postgres -c "SELECT COUNT(*) FROM agents;"

# Check API
curl http://localhost:7100/health

# Check web
curl http://localhost:3000/
```

**Actual Results**:


**Status**: ⬜ Complete

**Notes**:


---

## Phase 1 Tests (From agent-stack-testing effort)

### Test 1: Start Conversation (CONVERSE Mode)
**Reference**: [Phase 1 Testing Doc](../agent-stack-testing/phase-1-context-agent.md)
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: User opens chat and starts conversation with blog-post-writer

**Test Steps**:
1. Open web UI at http://localhost:3000
2. Select blog-post-writer agent
3. Verify Talk button selected by default
4. Type: "Hello, I'd like to write a blog post about Kubernetes"
5. Click Send or press Ctrl+T
6. Wait for response

**Expected Results**:
- Message sent successfully
- Response received within 3 seconds
- Response relevant to request
- Conversation saved to database
- Mode indicator shows "💬 Talking"

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: Converse Back-and-Forth
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Multi-turn conversation maintains context

**Test Steps**:
1. Continue from Test 1
2. Send: "The audience is DevOps engineers with 2-3 years experience"
3. Verify response acknowledges audience
4. Send: "I want to focus on best practices"
5. Verify response builds on previous context

**Expected Results**:
- Each response builds on conversation history
- Agent remembers audience and focus
- Natural conversation flow

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: Transition to Plan Mode (PLAN Create)
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: User transitions to planning

**Test Steps**:
1. Continue from Test 2
2. Click Plan button or press Ctrl+P
3. Verify Plan button now selected
4. Type: "Create a plan for this blog post"
5. Send message
6. Wait for plan to be created

**Expected Results**:
- Mode switches to Plan
- Mode indicator shows "📋 Planning"
- Plan created from conversation history
- Plan follows plan_structure schema
- Plan displayed in UI
- Plan has sections, target_audience, keywords

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: Navigate Between Talk and Plan
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Switch modes back and forth

**Test Steps**:
1. Continue from Test 3 (in Plan mode)
2. Click Talk button
3. Send a conversational message
4. Verify mode is Talk
5. Click Plan button
6. Verify existing plan still visible
7. Send plan update request

**Expected Results**:
- Smooth mode transitions
- Plan persists when switching to Talk
- Conversation continues in Talk mode
- Plan updates in Plan mode

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: Update Plan (PLAN Edit)
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Edit plan creates new version

**Test Steps**:
1. In Plan mode
2. Send: "Add a section about monitoring and observability"
3. Wait for plan to update
4. Verify new version created
5. Verify version number incremented
6. View version history if available

**Expected Results**:
- New plan version created (v2)
- Plan updated with new section
- Original plan (v1) still accessible
- Version history shown in UI

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 6: Plan List Versions
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: View all plan versions

**Test Steps**:
1. Click "View versions" or similar UI element
2. Verify both v1 and v2 shown
3. Compare versions
4. Select v1 to view
5. Select v2 to view

**Expected Results**:
- All versions listed
- Can view each version
- Clear indication of current version
- Timestamps for each version

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 7: Delete Plan Version (PLAN Delete_Version)
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Delete a plan version (not the current one)

**Test Steps**:
1. From version list, select v1
2. Click "Delete this version"
3. Confirm deletion
4. Verify v1 removed from list
5. Verify v2 (current) still exists

**Expected Results**:
- Version deleted successfully
- Not allowed to delete current version
- Other versions unaffected
- UI updates to reflect deletion

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 8: Build Button Presence and Functionality
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Transition to Build mode and create deliverable

**Test Steps**:
1. Click Build button or press Ctrl+B
2. Verify Build button selected
3. Mode indicator shows "🔨 Building"
4. Type: "Generate the blog post"
5. Send message
6. Wait for deliverable creation
7. Verify deliverable displayed

**Expected Results**:
- Mode switches to Build
- Deliverable created from plan v2 (current)
- Deliverable follows deliverable_structure
- Deliverable validates against io_schema
- Deliverable has introduction, body, conclusion
- Metadata includes word_count, reading_time
- Deliverable displayed in UI

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Phase 1 Test Summary

**Total Tests**: 8
**Passed**: 0
**Failed**: 0
**Blocked**: 0

**Critical Issues**:


**Non-Critical Issues**:


**Performance Notes**:


---

## Deviations from Expected Behavior

Document any differences from the Phase 1 test plan:


---

## Next Steps

After Phase 1 tests pass:
1. Document any issues found
2. Update PRD if design changes needed
3. Move to Phase 2 testing (API agents)
4. Create Phase 2 implementation plan

---

## Sign-Off

### Phase 1 Unblocked: ⬜ Yes / ⬜ No

**Sign-Off By**: Claude
**Date**:

**Notes**:


**Agent Stack Status**: ⬜ Ready for Phase 2 / ⬜ Needs Fixes

---

## Completion Checklist

- [ ] Blog post writer agent configured with schemas
- [ ] All 8 Phase 1 tests executed
- [ ] All 8 Phase 1 tests passing
- [ ] Issues documented
- [ ] PRD updated if needed
- [ ] Phase 1 effort complete
- [ ] Ready to merge implement-agent-modes branch

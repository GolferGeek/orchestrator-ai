# Phase 0: CRITICAL CHANGES - Nuclear Cleanup

## ⚠️ MAJOR SCOPE CHANGE

This document clarifies the **NUCLEAR** cleanup approach for Phase 0.

## What Changed

**OLD Phase 0:** Delete execution code, keep base/ utilities
**NEW Phase 0:** Delete EVERYTHING except agent2agent + demo

## The Nuclear Approach

### Keep ONLY Two Things
1. ✅ `apps/api/src/agent2agent/` - The ONE TRUE agent execution system
2. ✅ `apps/api/src/agents/demo/` - Reference agents (not executed)

### Delete EVERYTHING Else

#### Delete Entire Directories
- ❌ `apps/api/src/agents/base/` - **DELETE ENTIRE DIRECTORY**
  - All base implementations
  - All orchestrator services
  - All specialist implementations
  - EVERYTHING

- ❌ `apps/api/src/agents/loaders/` - All YAML loaders
- ❌ `apps/api/src/agents/parsers/` - All parsers
- ❌ `apps/api/src/agents/registry/` - File-based registry

#### Delete Individual Files
- ❌ `apps/api/src/agents/dynamic-agents.controller.ts`
- ❌ `apps/api/src/agents/dynamic-agents.service.ts`
- ❌ All agent execution code scattered anywhere

#### Clean Up Other Modules
- **llms/ directory:**
  - ❌ DELETE: Any agent execution logic
  - ✅ KEEP: LLM clients, token counting, model config

- **mcp/ directory:**
  - ❌ DELETE: Any agent execution logic
  - ✅ KEEP: MCP protocol implementation only

### Handle Strays

**IF** agent2agent needs a file from deleted code:
1. **MOVE** it into `agent2agent/` directory
2. Update imports
3. No files outside agent2agent (except demo)

**OTHERWISE:**
- **DELETE** it

## Why This Matters

### Problem with Half-Measures
- Keeping base/ utilities → confusion about what's used
- Scattered agent code → hard to maintain
- Mixed responsibilities → bugs and complexity

### Nuclear Cleanup Benefits
- **Crystal clear:** Only TWO agent-related directories
- **Zero confusion:** ONE execution system
- **Clean modules:** llms/ is just LLMs, mcp/ is just MCP
- **Fast development:** No legacy code to navigate
- **Easy testing:** One code path to test

## After Cleanup

```
apps/api/src/
├── agent2agent/           ✅ ONLY agent execution system
│   ├── controllers/       All agent API endpoints
│   ├── services/          All agent business logic
│   ├── dto/               All agent DTOs
│   └── guards/            All agent guards
│
├── agents/
│   └── demo/              ✅ Reference agents (YAML files, types, examples)
│
├── llms/                  ✅ Clean LLM integrations only
│   ├── clients/           OpenAI, Anthropic, Google clients
│   ├── config/            Model configurations
│   └── services/          Token counting, rate limiting
│
├── mcp/                   ✅ Clean MCP protocol only
│   ├── protocol/          MCP spec implementation
│   └── handlers/          MCP message handlers
│
├── deliverables/          ✅ Universal deliverables API
├── supabase/              ✅ Database layer
├── auth/                  ✅ Authentication
└── [other modules]        ✅ Focused, simple modules
```

## What This Means for You

### Tomorrow Morning (Starting Phase 0)

**Step 1: Understand the scope**
- This is BIG DELETE operation
- You're removing 50%+ of agent-related code
- It's scary but RIGHT

**Step 2: Start with big deletes**
```bash
# The nuclear option
rm -rf apps/api/src/agents/base/
rm apps/api/src/agents/dynamic-agents.*
# ... etc
```

**Step 3: Clean up modules**
- Find agent code in llms/, mcp/
- Delete or move to agent2agent/

**Step 4: Test**
- blog_post_writer still works?
- Agent list loads?
- If yes → you're done!

**Step 5: Celebrate**
- Codebase is 40-50% smaller
- Architecture is crystal clear
- Ready for rapid Phase 1 development

## Decision Points

### Q: What if we need something from base/ later?
**A:** We won't. agent2agent is self-contained. If we DO need it, we'll rewrite it properly in agent2agent.

### Q: Isn't this risky?
**A:** Less risky than maintaining two systems. Git has the old code if needed.

### Q: What about demo/ agents?
**A:** Keep them as reference/documentation. They're not executed, just examples.

### Q: Can we be more conservative?
**A:** No. Conservative = confusion. Nuclear = clarity.

## Success Criteria

Phase 0 is done when:

- ✅ `rm -rf apps/api/src/agents/base/` succeeds
- ✅ Only agent2agent/ and demo/ remain in agents code
- ✅ llms/ has no agent execution code
- ✅ mcp/ has no agent execution code
- ✅ `npm run build` succeeds
- ✅ blog_post_writer still works
- ✅ Codebase is 40-50% smaller
- ✅ You feel lighter and faster

## The Mindset

**This is not cleanup. This is liberation.**

You're removing years of accumulated complexity. You're choosing simplicity over completeness. You're committing to ONE way of doing things.

It will feel scary. Do it anyway.

The other side is beautiful: Clean code. Fast development. No confusion.

## Go Time

Read the [full Phase 0 PRD](./phase-0-aggressive-cleanup-prd.md) for implementation details.

Then delete with confidence. 🔥

---

**Updated:** 2025-10-03
**Scope:** NUCLEAR (not conservative)
**Timeline:** Still 3 days (delete is faster than refactor)
**Confidence:** HIGH (we have agent2agent working, everything else is baggage)

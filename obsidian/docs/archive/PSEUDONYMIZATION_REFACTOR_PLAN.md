# Pseudonymization Architecture Refactor Plan

## Overview
Refactor the pseudonymization system to use a clean architecture where:
- **PIIService**: Detects PII, checks for showstoppers, creates metadata with flags and pseudonym instructions
- **CentralizedRoutingService**: Orchestrates initial PII processing, passes metadata through system
- **LLM Service**: Applies/reverses pseudonyms right before/after external LLM calls using PseudonymizerService
- **Agents**: Transparent conduits that pass metadata through without modification
- **Metadata**: Flows end-to-end from request to UI response for user transparency

## Task List

### Phase 1: Foundation
1. **define-metadata-structure** (IN PROGRESS)
   - Define the metadata structure that flows through the system
   - Should contain flags (showstoppers, warnings) and pseudonym instructions/results

2. **refactor-pii-service-role** 
   - Refactor PIIService to focus on: PII detection, showstopper checks, and creating metadata structure with flags and pseudonym instructions (not actual pseudonyms)

### Phase 2: Flow Implementation
3. **update-centralized-routing-orchestration**
   - Update CentralizedRoutingService to call PIIService for initial processing and pass metadata structure through to agents

4. **modify-llm-service-boundary-processing**
   - Modify LLM Service to call PseudonymizerService for actual pseudonym creation/reversal right before/after external LLM calls, using metadata instructions

5. **implement-metadata-flow-through-agents**
   - Ensure agents pass metadata structure through without modification - agents become transparent conduits

6. **handle-function-agent-wrapper**
   - Handle the function agent wrapper layer - ensure metadata flows through the wrappedLLMService in FunctionAgentBaseService so function agents get the same pseudonymization treatment

### Phase 3: Integration & Testing
7. **update-response-structure**
   - Update response structure to include metadata so UI can display what was processed/protected

8. **test-new-architecture-end-to-end**
   - Test the new architecture end-to-end: metadata creation, flow through system, pseudonymization at LLM boundary, reversal, and metadata in response

9. **cleanup-old-pseudonymization-logic**
   - Remove old scattered pseudonymization logic that's no longer needed after architectural refactor

## Key Files to Modify
- `src/services/pii.service.ts` - Refactor role
- `src/llms/centralized-routing.service.ts` - Add orchestration
- `src/llms/llm.service.ts` - Boundary processing
- `src/agents/base/implementations/base-services/function/typescript/function-agent-base.service.ts` - Wrapper handling
- All agent base services - Metadata flow

## Current Status
- Step 1 is IN PROGRESS
- All other steps are PENDING
- Previous pseudonymization system is working but needs architectural cleanup

## Architecture Benefits
- Single point of pseudonymization control at LLM boundary
- Rich metadata for UI transparency
- Clean separation of concerns
- Works with all agent types (Context, Function, Orchestrator, API)
- Scalable for future PII policies

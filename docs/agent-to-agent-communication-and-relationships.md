# Agent-to-Agent Communication and Relationships PRD

**Version:** 1.0  
**Date:** January 2025  
**Status:** Planning

## Executive Summary

Enable agents within the Orchestra AI framework to communicate and collaborate with each other through context-defined relationships, allowing for complex multi-agent workflows while maintaining the clean architecture and simplicity required for small team adoption.

## Problem Statement

### Current State
- Agents operate in isolation, only receiving requests from the orchestrator
- Complex workflows requiring multiple agents must be manually coordinated through the orchestrator
- No mechanism for agents to leverage each other's capabilities directly
- Limited ability to create "swarm" or team-based agent behaviors

### Business Impact
- **Small Teams**: Cannot easily create sophisticated multi-agent workflows without complex orchestrator logic
- **Scalability**: All coordination logic concentrated in the orchestrator creates bottleneck
- **Flexibility**: Adding new collaborative patterns requires orchestrator modifications
- **User Experience**: Complex requests requiring multiple agents take longer and have more failure points

## Goals and Success Criteria

### Primary Goals
1. **Enable Agent Collaboration**: Agents can call other agents based on context-defined relationships
2. **Maintain Architecture Simplicity**: No new agent types, leverage existing 5-type structure
3. **Preserve User Mental Model**: Single entry point through orchestrator remains primary interface
4. **Support Small Teams**: Configuration-driven approach that doesn't require deep technical knowledge

### Success Criteria
- Marketing swarm leader can coordinate blog post creation with metrics analysis
- Function agents can compose complex workflows from specialist agents
- Agent relationships are declaratively defined in context files
- No performance degradation for single-agent requests
- Implementation adds <200 lines of code to existing agent types

## Target Users

### Primary Users
- **Small Development Teams**: 2-10 person teams implementing agentic systems
- **Business Users**: Non-technical stakeholders who need complex multi-step workflows

### Secondary Users
- **System Integrators**: Teams building Orchestra AI implementations for clients
- **Agent Developers**: Developers creating new specialized agents

## Solution Overview

### Core Concept
Add **coordination capability** to existing agent types rather than creating new agent types. Agents can define relationships in their context files and use an injected coordination service to communicate with specific other agents.

### Architecture Principles
1. **Capability, Not Type**: Coordination is an optional capability agents can use
2. **Context-Driven**: Relationships defined declaratively in agent context files
3. **HTTP-First**: All agent communication uses HTTP/A2A protocol for consistency
4. **Protocol Uniform**: Same communication pattern for all agents regardless of location

## Detailed Requirements

### Functional Requirements

#### FR1: Context-Defined Relationships
- Agents can define relationships to other agents in their `agent.yaml` context files
- Relationships specify agent name/path and description of capability
- Support for both internal agents (`specialists/blog_post`) and external agents (`external/market_research`)

```yaml
relationships:
  blog_post_agent: "specialists/blog_post"
  market_research_agent: "external/market_research_api"
  metrics_agent: "specialists/metrics"
```

#### FR2: Coordination Service
- Injectable service that handles agent-to-agent communication via HTTP/A2A protocol
- Reads agent pool to get agent cards and endpoints for relationship targets
- Uniform A2A protocol calls for all agent communication (internal and external)
- Provides clean interface for agent-to-agent HTTP communication

#### FR3: Function Agent Integration
- Function agents can access coordination service through enhanced `AgentFunctionParams`
- No changes required to existing function signatures for non-coordinating agents
- Coordination calls return structured responses compatible with existing patterns

#### FR4: Error Handling and Fallbacks
- Graceful degradation when relationship targets are unavailable
- Clear error messages indicating which agent relationships failed
- Ability to continue workflow with partial results

### Non-Functional Requirements

#### NFR1: Performance
- All agent calls use HTTP/A2A protocol for consistency and simplicity
- Acceptable performance overhead for the benefit of uniform communication
- No performance impact for agents that don't use coordination

#### NFR2: Maintainability
- Relationship definitions are explicit and visible in context files
- Agent coordination logic is separate from core agent functionality
- Debugging support to trace agent-to-agent communication paths

#### NFR3: Scalability
- Support for 5-10 relationships per agent without performance degradation
- Efficient agent pool queries for relationship resolution
- Prevention of circular delegation loops

## Technical Implementation

### Component Overview

#### AgentCoordinationService
```typescript
@Injectable()
export class AgentCoordinationService {
  async callAgent(request: AgentCallRequest): Promise<AgentCallResponse>
  async callAgentTeam(request: TeamCallRequest): Promise<TeamCallResponse>
  private discoverAgentEndpoint(agentPath: string): Promise<AgentEndpoint>
}
```

#### Enhanced Function Parameters
```typescript
interface AgentFunctionParams {
  // ... existing fields
  coordinationService?: AgentCoordinationService;
  agentContext?: {
    relationships?: Record<string, string>;
    // ... other context data
  };
}
```

#### Context File Extensions
- Add optional `relationships` section to agent.yaml files
- Maintain backward compatibility with existing context files
- Support for relationship metadata (descriptions, capabilities)

### Integration Points

#### Agent Discovery Service
- Enhanced to register both HTTP endpoints and service instances
- Support for querying agent capabilities by path/name
- Integration with existing agent pool management

#### Function Agent Base Service
- Inject coordination service into function parameters
- Parse relationships from context data
- Provide debugging/logging for coordination calls

#### A2A Protocol Compliance
- All coordination uses HTTP/A2A protocol for uniform communication
- Same authentication and security patterns for all agent calls
- Leverage existing A2A infrastructure for internal and external agents

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Implement `AgentCoordinationService`
- Enhance `AgentFunctionParams` with coordination capability
- Update context file parsing for relationships

### Phase 2: Function Agent Integration (Week 2-3)
- Integrate coordination service into `FunctionAgentBaseService`
- Implement HTTP/A2A call routing for all agent communication
- Add error handling and fallback mechanisms

### Phase 3: A2A External Calls (Week 3-4)
- Integrate external agent calling via A2A protocol
- Implement authentication forwarding for external calls
- Add performance monitoring for external coordination

### Phase 4: Testing and Documentation (Week 4-5)
- Create marketing swarm leader as reference implementation
- Comprehensive testing of coordination patterns
- Documentation and examples for small teams

## Risk Assessment

### Technical Risks
- **Circular Dependencies**: Agents calling each other in loops
  - *Mitigation*: Call depth limits and loop detection
- **Performance Degradation**: Too many coordination calls slowing responses
  - *Mitigation*: Async coordination patterns and timeout management
- **Authentication Complexity**: Managing auth context across agent calls
  - *Mitigation*: Leverage existing A2A authentication patterns

### Business Risks
- **Feature Complexity**: Small teams might find coordination too complex
  - *Mitigation*: Provide clear examples and limit initial relationship count
- **Debugging Difficulty**: Multi-agent workflows harder to troubleshoot
  - *Mitigation*: Enhanced logging and tracing for coordination calls

## Success Metrics

### Technical Metrics
- Function agent coordination calls complete in <2s via HTTP/A2A protocol
- Zero circular dependency incidents in testing
- 95% success rate for agent relationship resolution

### Business Metrics
- 3+ reference implementations using agent coordination
- Positive feedback from 5+ small team implementations
- No regression in single-agent workflow performance

## Future Considerations

### Potential Enhancements
- **Dynamic Relationships**: Agents discovering new relationships at runtime
- **Relationship Optimization**: Learning which agent combinations work best
- **Coordination Patterns**: Pre-built templates for common multi-agent workflows
- **Visual Relationship Mapping**: Tools to visualize agent relationship networks

### Scaling Considerations
- Support for agent relationship hierarchies (teams of teams)
- Integration with external agent marketplaces
- Cross-organization agent coordination protocols 
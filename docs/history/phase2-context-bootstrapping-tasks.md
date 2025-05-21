# 📝 Phase 2: Context-Based Agent Bootstrapping - Task Breakdown

This document provides a detailed task breakdown for implementing Phase 2 of the agent framework build, focusing on creating the markdown-based context system and shared MCP (Message Control Program) for all agents.

## 🔄 Overview

Phase 2 establishes a foundation where each agent can leverage markdown files as knowledge bases, enabling useful responses without complex infrastructure like vector databases. We'll create:

1. A shared MCP for context processing
2. Context markdown files for all agents
3. An example implementation using the metrics agent

## 🛠️ Task 1: Create Shared MCP for Context Processing

### 1.1. Design MCP Architecture
- [ ] Define function signatures and parameters
- [ ] Design the prompt template structure
- [ ] Plan error handling approach

### 1.2. Implement Core MCP Module
- [ ] Create `shared/llm_mcp.py`
- [ ] Implement context loading function
- [ ] Create prompt construction logic
- [ ] Add LLM calling functionality (OpenAI)

### 1.3. Add Configuration Options
- [ ] Create environment variable handling
- [ ] Add model selection parameters
- [ ] Implement temperature and other LLM controls
- [ ] Add logging for debugging

### 1.4. Test MCP Module
- [ ] Create basic test with sample context
- [ ] Verify context loading works correctly
- [ ] Test prompt construction
- [ ] Validate LLM response handling

## 🛠️ Task 2: Create Context Markdown Files

### 2.1. Create Directory Structure
- [ ] Create `markdown_context/` at project root
- [ ] Add subdirectories if needed for organization

### 2.2. Create Metric Agent Context
- [ ] Create `markdown_context/metrics_agent.md`
- [ ] Add sample metrics data (YTD, monthly breakdowns)
- [ ] Include metric interpretation guidelines
- [ ] Add example queries and responses

### 2.3. Create Marketing Swarm Context
- [ ] Create `markdown_context/marketing_swarm.md`
- [ ] Add marketing strategy frameworks
- [ ] Include industry best practices
- [ ] Add sample campaign structures

### 2.4. Create Blog Post Writer Context
- [ ] Create `markdown_context/write_blog_post.md`
- [ ] Add blog post templates and structures
- [ ] Include writing style guidelines
- [ ] Add SEO best practices

### 2.5. Create Requirements Writer Context
- [ ] Create `markdown_context/requirements_writer.md`
- [ ] Add software requirements templates
- [ ] Include user story formats
- [ ] Add acceptance criteria examples
- [ ] Include technical specification guidelines

## 🛠️ Task 3: Implement Metrics Agent with OpenAI SDK

### 3.1. Update Agent JSON for Metrics
- [ ] Update `.well-known/metrics_agent/agent.json`
- [ ] Add example queries and responses
- [ ] Update skill descriptions to reflect markdown capabilities

### 3.2. Create OpenAI SDK Integration
- [ ] Create `agents/metrics_agent/routes.py` if not exists
- [ ] Import shared MCP module
- [ ] Create endpoint for metrics queries
- [ ] Implement request validation with Pydantic

### 3.3. Connect Context to Agent
- [ ] Add context loading logic
- [ ] Create function to call MCP with metrics context
- [ ] Format responses appropriately
- [ ] Add error handling

### 3.4. Test Metrics Agent
- [ ] Test basic metrics queries
- [ ] Validate response format
- [ ] Test edge cases (missing metrics, etc.)
- [ ] Verify orchestrator integration

## 🛠️ Task 4: Create Utility Scripts for Context Management

### 4.1. Create Context Validation Script
- [ ] Create script to validate markdown syntax
- [ ] Check for required sections in each context file
- [ ] Ensure context files follow team standards

### 4.2. Create Context Update Helper
- [ ] Create utility to assist with context updates
- [ ] Add option to refresh context without restarting service

## 🧪 Testing Strategy

For each implemented component:
- Unit test the MCP functions
- Verify markdown loading functionality
- Test LLM response formatting
- E2E test with sample queries for each agent

## 📊 Acceptance Criteria

Phase 2 is complete when:
- Shared MCP can load any agent's markdown context
- All planned context files are created and validated
- Metrics agent can respond to queries using the context
- OpenAI SDK integration is working correctly
- Error handling is robust

## 📚 Implementation Guidelines

1. **Modularity**: Keep the MCP generic enough to work with any agent context
2. **Error Handling**: Gracefully handle context loading failures
3. **Efficiency**: Minimize redundant LLM calls
4. **Documentation**: Comment code thoroughly for future developers
5. **Testing**: Create test cases for various query types 
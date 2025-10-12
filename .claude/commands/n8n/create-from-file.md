---
description: "Create an n8n workflow from a PRD or requirements document"
argument-hint: "path/to/prd.md or path/to/requirements.txt"
model: "claude-opus-4-20250514"
---

# Create n8n Workflow from Document

You are creating an n8n workflow based on a PRD or requirements document at: $ARGUMENTS

## Your Organization's Helper LLM Pattern

**Reusable Sub-Workflow ID:** `9jxl03jCcqg17oOy`  
**Name:** "Helper: LLM Task"

This is your organization's standard building block. See `/n8n:create` command for full Helper LLM documentation.

**Quick Reference:**
```javascript
// Execute Workflow node calling Helper LLM
{
  "workflowId": "9jxl03jCcqg17oOy",
  "fieldMapping": {
    "fields": [
      { "name": "provider", "value": "openai|anthropic|ollama" },
      { "name": "model", "value": "model-name" },
      { "name": "prompt", "value": "task-specific prompt" },
      { "name": "temperature", "value": 0.5-0.8 },
      { "name": "maxTokens", "value": 800-1200 },
      // ... status tracking fields
    ]
  }
}
```

## Organization Standards

### **Temperature Guidelines**
- **0.5** - Factual, analytical (SEO, data analysis)
- **0.7** - General purpose (most tasks)
- **0.8** - Creative (social media, marketing copy)

### **Token Guidelines**
- **800** - Short, focused output
- **1000** - Standard response
- **1200+** - Longer, detailed content

### **Webhook Defaults**
- Status webhook: `http://host.docker.internal:7100/webhooks/status`
- Path pattern: `/webhook/workflow-name-from-prd`

## Steps to Create Workflow

1. **Read the document:**
   - Read the file at $ARGUMENTS
   - Parse requirements, objectives, steps
   - Identify what the workflow should accomplish

2. **Analyze requirements:**
   - How many LLM steps are needed?
   - Should steps run in parallel or sequence?
   - What are the inputs and outputs?
   - Are there any integrations needed (beyond LLM)?

3. **Extract key information:**
   - Workflow purpose and name
   - Input parameters
   - Processing steps
   - Output format
   - Any specific LLM provider/model requirements

4. **Design workflow structure:**

   **For Single LLM Task:**
   ```
   Webhook → Extract Config → Helper LLM → Respond
   ```

   **For Multiple Sequential Tasks:**
   ```
   Webhook → Extract Config → Helper LLM 1 → Helper LLM 2 → Combine → Respond
   ```

   **For Multiple Parallel Tasks (like Marketing Swarm):**
   ```
   Webhook → Extract Config → Start Status
     ├→ Helper LLM Task 1 ─┐
     ├→ Helper LLM Task 2 ─┤
     └→ Helper LLM Task 3 ─┤
                           ↓
                    Combine Results → Final Status → Respond
   ```

5. **Map PRD requirements to Helper LLM calls:**
   - Each major task becomes one Helper LLM call
   - Set appropriate prompts from PRD objectives
   - Set temperature based on task type (creative vs factual)
   - Set maxTokens based on expected output length

6. **Create the workflow using n8n MCP:**
   - Use `mcp_n8n-mcp_n8n_create_workflow` tool
   - Build nodes array with proper positioning
   - Build connections object
   - Include status tracking nodes

7. **Validate and return:**
   - Use `mcp_n8n-mcp_validate_workflow` to check
   - Provide workflow details and activation steps

## Example: PRD for Content Pipeline

**Document:** `docs/prd/content-pipeline.md`

**PRD Says:**
```
Objective: Generate marketing content from announcements

Steps:
1. Generate blog post (HTML format)
2. Create SEO metadata (title, description, keywords)
3. Generate social media posts (Twitter, LinkedIn, Facebook)

Inputs: announcement text, target audience
Outputs: Complete marketing package
```

**Resulting Workflow Design:**
- Name: "Content Pipeline"
- Webhook: `/webhook/content-pipeline`
- 3 parallel Helper LLM calls:
  1. Blog post (temp: 0.7, tokens: 1500)
  2. SEO content (temp: 0.5, tokens: 800)
  3. Social media (temp: 0.8, tokens: 1200)
- Combine results into structured output

## Input Extraction from PRD

Look for:
- **Objectives/Purpose** → Workflow description
- **Steps/Tasks** → Helper LLM calls (one per major task)
- **Inputs** → Webhook parameters to accept
- **Outputs** → What to return
- **Requirements** → Model/provider preferences
- **Constraints** → Token limits, temperature settings

## Creating Complex Workflows

### **When PRD has many steps:**
Consider grouping into logical phases:
- Phase 1: Data gathering
- Phase 2: Processing
- Phase 3: Output generation

### **When steps have dependencies:**
Use sequential Helper LLM calls:
```javascript
Step 1 → Helper LLM (research)
  ↓ (output feeds into)
Step 2 → Helper LLM (analyze research)
  ↓ (output feeds into)
Step 3 → Helper LLM (create report)
```

### **When steps are independent:**
Use parallel Helper LLM calls (like Marketing Swarm):
```javascript
     ┌→ Helper LLM (task 1) ─┐
Start├→ Helper LLM (task 2) ─┤→ Combine → End
     └→ Helper LLM (task 3) ─┘
```

## Field Mapping Pattern

When calling Helper LLM, always include:

**Required:**
```javascript
{ "name": "prompt", "value": "your task-specific prompt" }
```

**Recommended:**
```javascript
{ "name": "provider", "value": "={{ $('Extract Config').item.json.provider || 'openai' }}" }
{ "name": "model", "value": "={{ $('Extract Config').item.json.model || 'gpt-4' }}" }
{ "name": "temperature", "value": 0.7 }
{ "name": "maxTokens", "value": 1000 }
```

**For Status Tracking:**
```javascript
{ "name": "sendStartStatus", "value": true }
{ "name": "sendEndStatus", "value": true }
{ "name": "statusWebhook", "value": "={{ $('Extract Config').item.json.statusWebhook }}" }
{ "name": "taskId", "value": "={{ $('Extract Config').item.json.taskId }}" }
{ "name": "conversationId", "value": "={{ $('Extract Config').item.json.conversationId }}" }
{ "name": "userId", "value": "={{ $('Extract Config').item.json.userId }}" }
{ "name": "stepName", "value": "descriptive_name" }
{ "name": "sequence", "value": 1 }
{ "name": "totalSteps", "value": "total_count" }
```

## Workflow Creation Steps

1. **Parse the description** in $ARGUMENTS
2. **Identify LLM tasks** (how many Helper LLM calls needed?)
3. **Determine execution pattern** (parallel or sequential?)
4. **Design node structure** with proper positioning
5. **Create workflow** using `mcp_n8n-mcp_n8n_create_workflow`
6. **Validate** using `mcp_n8n-mcp_validate_workflow`
7. **Report results** with webhook URL and test command

## Output Format

```
✅ Workflow Created Successfully

📋 Details:
- Name: [Generated Name]
- ID: [workflow-id]
- Pattern: [Single LLM | Parallel LLM | Sequential LLM]
- Helper LLM Calls: [count]

🔗 Webhook URL:
http://localhost:5678/webhook/[workflow-path]

📥 Input Format:
{
  "taskId": "uuid",
  "provider": "openai",     // optional
  "model": "gpt-4",         // optional
  ... [other inputs based on description]
}

🔧 Test Command:
curl -X POST http://localhost:5678/webhook/[path] \
  -H "Content-Type: application/json" \
  -d '{"taskId": "test-123", ...}'

📝 Next Steps:
1. Activate workflow in n8n UI (http://localhost:5678)
2. Test with the command above
3. Integrate into your application
```

## Remember

- Always use Helper LLM (9jxl03jCcqg17oOy) for LLM calls
- Include status tracking for observability
- Set temperature based on task creativity needs
- Use parallel execution when tasks are independent
- Validate before completing


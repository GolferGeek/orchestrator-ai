---
description: "Create an n8n workflow from a text description"
argument-hint: "workflow description"
model: "claude-opus-4-20250514"
---

# Create n8n Workflow from Description

You are creating an n8n workflow based on the description provided in $ARGUMENTS.

## Your Organization's Helper LLM Pattern

**Reusable Sub-Workflow ID:** `9jxl03jCcqg17oOy`  
**Name:** "Helper: LLM Task"

This is your organization's standard building block for LLM-backed workflows. It handles:
- Multi-provider support (OpenAI, Anthropic, Ollama)
- Status tracking via webhooks
- Normalized output format
- Error handling

**How to Call Helper LLM:**
Use "Execute Workflow" node with these parameters:

```javascript
{
  "source": "database",
  "workflowId": "9jxl03jCcqg17oOy",
  "fieldMapping": {
    "fields": [
      { "name": "provider", "value": "openai|anthropic|ollama" },
      { "name": "model", "value": "gpt-4|claude-opus-4|llama2" },
      { "name": "prompt", "value": "Your task-specific prompt" },
      { "name": "temperature", "value": 0.7 },
      { "name": "maxTokens", "value": 1000 },
      { "name": "sendStartStatus", "value": true },
      { "name": "sendEndStatus", "value": true },
      { "name": "statusWebhook", "value": "http://host.docker.internal:7100/webhooks/status" },
      { "name": "taskId", "value": "{{ $input.taskId }}" },
      { "name": "conversationId", "value": "{{ $input.conversationId }}" },
      { "name": "userId", "value": "{{ $input.userId }}" },
      { "name": "stepName", "value": "descriptive_step_name" },
      { "name": "sequence", "value": 1 },
      { "name": "totalSteps", "value": "total_number_of_steps" }
    ]
  }
}
```

**Defaults:**
- Provider: openai
- Model: gpt-4
- Temperature: 0.7 (general), 0.5 (factual), 0.8 (creative)
- MaxTokens: 1000 (general), 800 (factual), 1200 (creative)
- Status Webhook: `http://host.docker.internal:7100/webhooks/status`

## Organization Standards

### **Webhook Structure**
Every workflow should:
- Start with Webhook trigger node
- Use POST method
- Path: `/webhook/workflow-name` (kebab-case)
- End with "Respond to Webhook" node

### **Status Tracking**
Include:
- Send workflow start status
- Send workflow end status  
- Pass taskId, conversationId, userId through all steps
- Use sequence numbers for progress

### **Error Handling**
- Use `continueOnFail: true` on status webhooks
- Use `ignoreResponseCode: true` on optional notifications

## Steps to Create Workflow

1. **Parse the description** in $ARGUMENTS to identify:
   - What the workflow should do
   - How many LLM steps needed
   - Whether steps should run parallel or sequential
   - What the inputs and outputs should be

2. **Design the workflow structure:**
   - Webhook trigger (entry point)
   - Extract Config node (parse input)
   - Send Workflow Start Status (optional)
   - One or more Helper LLM calls (Execute Workflow nodes)
   - Combine Results (if multiple LLM calls)
   - Send Final Status
   - Respond to Webhook (return results)

3. **For each LLM step:**
   - Create Execute Workflow node pointing to Helper LLM (9jxl03jCcqg17oOy)
   - Set appropriate prompt for the task
   - Set temperature based on task type
   - Set sequence and totalSteps
   - Name the step descriptively

4. **Create the workflow using n8n MCP:**
   - Use `mcp_n8n-mcp_n8n_create_workflow` tool
   - Build nodes array with proper IDs and positions
   - Build connections object
   - Set workflow name and settings

5. **Validate the workflow:**
   - Use `mcp_n8n-mcp_validate_workflow` to check
   - Fix any issues found

6. **Return workflow details:**
   - Workflow ID
   - Webhook URL: `http://localhost:5678/webhook/[path]`
   - Node count
   - Next steps (activate, test)

## Example: Simple Research Workflow

**Description:** "Create a workflow that researches a topic and summarizes findings"

**Resulting Workflow:**
```
Webhook (/webhook/research-summarizer)
  ↓
Extract Config (topic from body)
  ↓
Send Workflow Start
  ↓
Helper LLM Call (research prompt)
  ↓
Send Final Status
  ↓
Respond to Webhook
```

**Helper LLM Configuration:**
- prompt: "Research the following topic and provide a detailed summary: {{ $input.topic }}"
- temperature: 0.5 (factual)
- maxTokens: 1500
- stepName: "research_and_summarize"

## Output Format

Provide a summary like:

```
✅ Workflow Created Successfully

📋 Workflow Details:
- Name: Research Summarizer
- ID: [workflow-id]
- Nodes: 7 nodes configured

🔗 Webhook URL:
http://localhost:5678/webhook/research-summarizer

📥 Input Format:
{
  "topic": "your research topic",
  "provider": "openai",     // optional
  "model": "gpt-4",         // optional
  "taskId": "uuid",         // optional
  "userId": "uuid"          // optional
}

📤 Output Format:
{
  "text": "research summary...",
  "provider": "openai",
  "model": "gpt-4",
  "usage": { ... }
}

🔧 Next Steps:
1. Activate workflow in n8n UI
2. Test with: curl -X POST http://localhost:5678/webhook/research-summarizer -H "Content-Type: application/json" -d '{"topic": "AI agents"}'
```

## Remember

- Use Helper LLM (9jxl03jCcqg17oOy) as your building block
- Include status tracking for visibility
- Set appropriate temperature per task type
- Use parallel execution when tasks are independent
- Always validate before returning


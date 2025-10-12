---
description: "Create an n8n workflow from a PRD or requirements document"
argument-hint: "path/to/prd.md"
model: "claude-opus-4-20250514"
---

# Create n8n Workflow from PRD Document

You are creating an n8n workflow based on the PRD or requirements document at: $ARGUMENTS

## Your Organization's Helper LLM Pattern

**Reusable Sub-Workflow ID:** `9jxl03jCcqg17oOy`  
**Name:** "Helper: LLM Task"

This is your organization's standard building block for LLM-backed workflows. See `/n8n:create` for full details.

**Quick Call Pattern:**
```javascript
{
  "source": "database",
  "workflowId": "9jxl03jCcqg17oOy",
  "fieldMapping": {
    "fields": [
      { "name": "prompt", "value": "your prompt" },
      { "name": "provider", "value": "openai|anthropic|ollama" },
      { "name": "model", "value": "model-name" },
      { "name": "temperature", "value": 0.5-0.8 },
      { "name": "maxTokens", "value": 800-1200 },
      { "name": "stepName", "value": "step_name" },
      { "name": "sequence", "value": 1 },
      { "name": "totalSteps", "value": 3 },
      // ... status tracking fields (taskId, conversationId, userId, statusWebhook)
    ]
  }
}
```

## Organization Standards

### **Temperature by Task Type**
- **0.5** - Factual/analytical (SEO, data analysis, research)
- **0.7** - General purpose (most tasks)
- **0.8** - Creative (social media, marketing, storytelling)

### **Token Guidelines**
- **800** - Short, focused output (summaries, titles)
- **1000** - Standard response (general content)
- **1200-1500** - Longer output (blog posts, detailed analysis)

### **Default Status Webhook**
`http://host.docker.internal:7100/webhooks/status`

## Reference: Marketing Swarm Pattern

Your organization has built "Marketing Swarm - Flexible LLM" as a reference implementation.

**It demonstrates:**
- 3 parallel Helper LLM calls
- Different prompts for each task (web post, SEO, social media)
- Different temperature settings (0.7, 0.5, 0.8)
- Different token limits (1000, 800, 1200)
- Status tracking throughout
- Combined results at the end

**Study this pattern when building workflows with multiple tasks!**

## Steps to Process PRD

1. **Read the PRD document:**
   ```
   Read file: $ARGUMENTS
   ```

2. **Extract key information:**
   - **Objective/Purpose** → Workflow name and description
   - **Steps/Tasks** → Map to Helper LLM calls
   - **Inputs** → Webhook parameters
   - **Outputs** → Return format
   - **Requirements** → Provider/model preferences
   - **Constraints** → Token limits, quality requirements

3. **Identify workflow pattern:**
   
   **Pattern A: Single Task**
   ```
   Webhook → Extract → Helper LLM → Respond
   ```
   Use when: One clear LLM task
   
   **Pattern B: Sequential Tasks**
   ```
   Webhook → Extract → Helper LLM 1 → Helper LLM 2 → Combine → Respond
   ```
   Use when: Later tasks depend on earlier results
   
   **Pattern C: Parallel Tasks (Marketing Swarm Pattern)**
   ```
   Webhook → Extract → Start Status
     ├→ Helper LLM 1 ─┐
     ├→ Helper LLM 2 ─┤
     └→ Helper LLM 3 ─┘
                      ↓
               Combine → Final Status → Respond
   ```
   Use when: Multiple independent tasks

4. **Map PRD sections to LLM calls:**

   **Example PRD Structure:**
   ```markdown
   ## Objective
   Generate comprehensive blog content
   
   ## Steps
   1. Write main blog post (1500 words)
   2. Create meta description and title
   3. Generate social snippets
   
   ## Requirements
   - Use GPT-4 for accuracy
   - Ensure SEO optimization
   ```

   **Maps to:**
   - Helper LLM Call 1: "Write blog post..." (temp: 0.7, tokens: 2000)
   - Helper LLM Call 2: "Create SEO metadata..." (temp: 0.5, tokens: 300)
   - Helper LLM Call 3: "Generate social posts..." (temp: 0.8, tokens: 800)

5. **Build the workflow:**
   
   **Node Structure:**
   ```javascript
   nodes: [
     { 
       id: "webhook",
       name: "Webhook",
       type: "n8n-nodes-base.webhook",
       parameters: {
         httpMethod: "POST",
         path: "workflow-name-from-prd"
       }
     },
     {
       id: "extract-config",
       name: "Extract Config",
       type: "n8n-nodes-base.set",
       parameters: {
         assignments: {
           assignments: [
             // Extract from webhook body
           ]
         }
       }
     },
     {
       id: "send-start-status",
       name: "Send Workflow Start",
       type: "n8n-nodes-base.httpRequest",
       parameters: {
         method: "POST",
         url: "={{ $('Extract Config').item.json.statusWebhook }}",
         sendBody: true,
         specifyBody: "json",
         jsonBody: "={{ JSON.stringify({ ... }) }}"
       },
       continueOnFail: true
     },
     // ... Helper LLM calls (Execute Workflow nodes)
     {
       id: "task-1",
       name: "Task Name from PRD",
       type: "n8n-nodes-base.executeWorkflow",
       parameters: {
         source: "database",
         workflowId: "9jxl03jCcqg17oOy",
         fieldMapping: { ... }
       }
     },
     // ... more tasks
     {
       id: "combine-results",
       name: "Combine Results",
       type: "n8n-nodes-base.set",
       parameters: {
         assignments: {
           assignments: [
             { name: "task1Result", value: "={{ $('Task 1').item.json.text }}" },
             // ... more results
           ]
         }
       }
     },
     {
       id: "send-final-status",
       name: "Send Final Status",
       type: "n8n-nodes-base.httpRequest",
       // ... status webhook call
       continueOnFail: true
     },
     {
       id: "respond",
       name: "Respond to Webhook",
       type: "n8n-nodes-base.respondToWebhook",
       parameters: {
         respondWith: "json",
         responseBody: "={{ $json }}"
       }
     }
   ]
   ```

6. **Position nodes** (for visual clarity):
   ```javascript
   positions: {
     webhook: [240, 300],
     extract: [460, 300],
     start_status: [680, 300],
     task_1: [900, 180],   // Parallel tasks stacked vertically
     task_2: [900, 300],
     task_3: [900, 420],
     combine: [1120, 300],
     final_status: [1340, 300],
     respond: [1560, 300]
   }
   ```

7. **Build connections object:**
   ```javascript
   connections: {
     "Webhook": { "main": [[{ "node": "Extract Config" }]] },
     "Extract Config": { "main": [[{ "node": "Send Workflow Start" }]] },
     "Send Workflow Start": { 
       "main": [[
         { "node": "Task 1" },
         { "node": "Task 2" },
         { "node": "Task 3" }
       ]] 
     },
     // ... etc
   }
   ```

8. **Create via MCP and validate**

## Example PRD Processing

### **Input PRD:** `docs/prd/ai-research-assistant.md`

**PRD Content:**
```markdown
# AI Research Assistant Workflow

## Objective
Create a workflow that researches a topic, analyzes findings, and generates a report.

## Steps
1. Search for recent information on the topic
2. Analyze and synthesize findings
3. Generate formatted report with citations

## Requirements
- Use Anthropic Claude for accuracy
- Include source citations
- Output as markdown

## Inputs
- topic: string
- depth: "brief" | "detailed"

## Outputs
- report: markdown formatted research report
```

**Workflow Design:**
```
Name: "AI Research Assistant"
Path: /webhook/ai-research-assistant

Nodes:
1. Webhook trigger
2. Extract Config (topic, depth, provider, model)
3. Send Workflow Start
4. Helper LLM #1: Search prompt (sequence 1/3)
5. Helper LLM #2: Analyze prompt (sequence 2/3, uses output from #1)
6. Helper LLM #3: Generate report (sequence 3/3, uses outputs from #1 and #2)
7. Send Final Status
8. Respond with markdown report

Configuration:
- Provider: "anthropic" (from PRD requirement)
- Model: "claude-3-5-sonnet-20241022"
- Temperature: 0.5 (factual research)
- MaxTokens: 2000 (detailed report)
```

## Output Format

```
✅ Workflow Created from PRD

📋 Workflow Details:
- Name: [Name from PRD]
- ID: [workflow-id]
- Pattern: [Sequential | Parallel | Hybrid]
- Steps: [count] LLM tasks
- Based on: $ARGUMENTS

🔗 Webhook URL:
http://localhost:5678/webhook/[path]

📄 PRD Summary:
- Objective: [from PRD]
- Tasks: [list from PRD]
- Special Requirements: [from PRD]

📥 Input Format (from PRD):
{
  [inputs extracted from PRD]
}

📤 Output Format (from PRD):
{
  [outputs extracted from PRD]
}

🔧 Test Command:
curl -X POST http://localhost:5678/webhook/[path] \
  -H "Content-Type: application/json" \
  -d '{ [sample test payload] }'

📝 Next Steps:
1. Review workflow in n8n UI: http://localhost:5678
2. Activate the workflow
3. Test with sample data
4. Integrate into application
```

## Validation Checklist

Before completing, verify:
- [ ] All PRD objectives mapped to workflow steps
- [ ] Helper LLM calls configured correctly
- [ ] Status tracking included
- [ ] Appropriate temperature/token settings
- [ ] Parallel vs sequential logic correct
- [ ] Input parameters extracted from PRD
- [ ] Output format matches PRD expectations
- [ ] Workflow validates successfully

## Remember

- PRD is your source of truth - map all requirements
- Use Helper LLM for every LLM call (consistency!)
- Set temperature based on task creativity needs
- Use parallel execution when tasks are independent
- Sequential when later tasks need earlier results
- Always include status tracking for observability
- Validate before returning


# n8n Commands

Custom Claude commands for n8n workflow automation.

---

## Available Commands

### **`/n8n:create`**
Create an n8n workflow from a text description.

**Usage:**
```
/n8n:create Research workflow that gathers academic papers and summarizes them
```

**What it does:**
- Parses your description
- Designs workflow using Helper LLM pattern
- Creates workflow via n8n MCP
- Returns webhook URL and test command

---

### **`/n8n:create-from-prd`**
Create an n8n workflow from a PRD or requirements document.

**Usage:**
```
/n8n:create-from-prd docs/prd/content-pipeline-prd.md
```

**What it does:**
- Reads the PRD file
- Extracts objectives, steps, inputs, outputs
- Maps to Helper LLM calls (parallel or sequential)
- Creates workflow via n8n MCP
- Returns complete workflow details

---

## Organization Patterns

### **Helper LLM** (Building Block)
**ID:** `9jxl03jCcqg17oOy`

Every LLM call in your workflows should use this reusable sub-workflow:
- Multi-provider support (OpenAI, Anthropic, Ollama)
- Status tracking via webhooks
- Normalized output
- Flexible configuration

### **Status Tracking**
All workflows should send status updates to:
`http://host.docker.internal:7100/webhooks/status`

Format:
```json
{
  "taskId": "uuid",
  "status": "running|completed",
  "step": "step_name",
  "sequence": 1,
  "totalSteps": 3
}
```

### **Temperature Settings**
- **0.5** - Factual (SEO, research, data)
- **0.7** - General purpose
- **0.8** - Creative (social media, marketing)

---

## Examples

### **Simple Workflow (1 LLM call):**
```
/n8n:create Summarize articles into bullet points
```

### **Complex Workflow (multiple LLM calls):**
```
/n8n:create-from-prd docs/prd/marketing-automation.md
```

### **From PRD with specific requirements:**
```
/n8n:create-from-prd docs/prd/research-pipeline.md
```

---

## Reference Workflows

Study these for patterns:
- **Helper: LLM Task** (`9jxl03jCcqg17oOy`) - Base building block
- **Marketing Swarm - Flexible LLM** (`1LaQnwqSoTxmnw3Z`) - Parallel execution example

---

## n8n MCP Tools Used

Commands use these MCP tools:
- `mcp_n8n-mcp_n8n_create_workflow` - Create workflows
- `mcp_n8n-mcp_validate_workflow` - Validate configuration
- `mcp_n8n-mcp_n8n_list_workflows` - List existing workflows

---

**For detailed patterns:** See `n8n-Workflow-Patterns.md` in AI Coding Environment docs


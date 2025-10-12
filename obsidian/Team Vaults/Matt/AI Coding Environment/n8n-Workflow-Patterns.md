# n8n Workflow Patterns - Organization Standards

**Source:** Analyzed from production workflows  
**Date:** 2025-01-12  
**Purpose:** Document reusable n8n patterns for command automation

---

## Pattern 1: Helper LLM Task (Reusable Sub-Workflow)

**Workflow ID:** `9jxl03jCcqg17oOy`  
**Name:** "Helper: LLM Task"  
**Type:** Execute Workflow (called by other workflows)

### **Purpose:**
Reusable workflow that handles LLM calls with multiple provider support, status tracking, and normalized output.

### **Flow:**
```
Execute Workflow Trigger
  ↓
Check Send Start Status (optional)
  ↓ (if true)
Send Start Status → statusWebhook
  ↓
Select Provider (switch: openai, ollama, anthropic)
  ├→ OpenAI Request → Normalize OpenAI
  ├→ Ollama Request → Normalize Ollama
  └→ Anthropic Request → Normalize Anthropic
       ↓
     Merge Results
       ↓
Check Send End Status (optional)
  ↓ (if true)
Send End Status → statusWebhook
  ↓
Return Result
```

---

### **Input Parameters** (via Execute Workflow Trigger)

**Required:**
- `prompt` (string) - The prompt to send to LLM

**Optional:**
- `provider` (string) - "openai" | "ollama" | "anthropic" (default: "openai")
- `model` (string) - Model name (defaults: "gpt-4", "llama2", "claude-3-sonnet-20240229")
- `temperature` (number) - 0.0 to 1.0 (default: 0.7)
- `maxTokens` (number) - Max completion tokens (default: 1000)

**Status Tracking:**
- `sendStartStatus` (boolean) - Send start status webhook (default: false)
- `sendEndStatus` (boolean) - Send end status webhook (default: false)
- `statusWebhook` (string) - Webhook URL for status updates (default: "http://host.docker.internal:7100/webhooks/status")
- `taskId` (string) - Task identifier for tracking
- `conversationId` (string) - Conversation context
- `userId` (string) - User identifier
- `stepName` (string) - Name of this step in larger workflow
- `sequence` (number) - Step number in sequence
- `totalSteps` (number) - Total steps in parent workflow

---

### **Output Format** (Normalized)

```json
{
  "text": "LLM response content",
  "provider": "openai|ollama|anthropic",
  "model": "actual-model-used",
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456
  }
}
```

**Key Feature:** All three providers return the SAME normalized format!

---

### **Provider Configurations**

#### **OpenAI**
```javascript
// URL: https://api.openai.com/v1/chat/completions
// Headers: Authorization required (credential)
{
  "model": $input.model || "gpt-4",
  "messages": [{ "role": "user", "content": $input.prompt }],
  "temperature": $input.temperature || 0.7,
  "max_tokens": $input.maxTokens || 1000
}

// Normalization:
{
  "text": $json.choices[0].message.content,
  "provider": "openai",
  "model": $json.model,
  "usage": $json.usage
}
```

#### **Ollama**
```javascript
// URL: $input.baseUrl || "http://host.docker.internal:11434/api/generate"
{
  "model": $input.model || "llama2",
  "prompt": $input.prompt,
  "stream": false,
  "options": {
    "temperature": $input.temperature || 0.7,
    "num_predict": $input.maxTokens || 1000
  }
}

// Normalization:
{
  "text": $json.response,
  "provider": "ollama",
  "model": $json.model,
  "usage": {
    "prompt_tokens": $json.prompt_eval_count,
    "completion_tokens": $json.eval_count
  }
}
```

#### **Anthropic**
```javascript
// URL: https://api.anthropic.com/v1/messages
// Headers: x-api-key, anthropic-version required
{
  "model": $input.model || "claude-3-sonnet-20240229",
  "messages": [{ "role": "user", "content": $input.prompt }],
  "temperature": $input.temperature || 0.7,
  "max_tokens": $input.maxTokens || 1000
}

// Normalization:
{
  "text": $json.content[0].text,
  "provider": "anthropic",
  "model": $json.model,
  "usage": $json.usage
}
```

---

### **Status Webhook Format**

**Start Status:**
```json
{
  "taskId": "uuid",
  "status": "running",
  "timestamp": "2025-01-12T10:00:00.000Z",
  "step": "stepName",
  "message": "Starting stepName",
  "sequence": 1,
  "totalSteps": 4,
  "conversationId": "uuid",
  "userId": "uuid"
}
```

**End Status:**
```json
{
  "taskId": "uuid",
  "status": "completed",
  "timestamp": "2025-01-12T10:01:00.000Z",
  "step": "stepName",
  "message": "Completed stepName",
  "sequence": 1,
  "totalSteps": 4,
  "conversationId": "uuid",
  "userId": "uuid"
}
```

---

## Pattern 2: Marketing Swarm (Parallel LLM Execution)

**Workflow ID:** `1LaQnwqSoTxmnw3Z`  
**Name:** "Marketing Swarm - Flexible LLM"  
**Type:** Webhook trigger

### **Purpose:**
Generate marketing content (web post, SEO, social media) by calling Helper LLM three times in parallel.

### **Flow:**
```
Webhook (POST /webhook/marketing-swarm-flexible)
  ↓
Extract Config
  ↓
Send Workflow Start Status
  ↓
├─→ Web Post Task (Helper LLM call #1) ─┐
├─→ SEO Task (Helper LLM call #2) ──────┤
└─→ Social Media Task (Helper LLM call #3)
                                        ↓
                                  Combine Results
                                        ↓
                                  Send Final Status
                                        ↓
                                  Respond to Webhook
```

---

### **How It Uses Helper LLM**

Each task calls the Helper LLM workflow (`9jxl03jCcqg17oOy`) via "Execute Workflow" node:

#### **Web Post Task**
```javascript
{
  // LLM Config
  "provider": $input.provider,        // Passed through
  "model": $input.model,              // Passed through
  "prompt": "Write a compelling web post announcement for: " + $input.announcement,
  "temperature": 0.7,
  "maxTokens": 1000,
  
  // Status Tracking
  "sendStartStatus": true,
  "sendEndStatus": true,
  "statusWebhook": $input.statusWebhook,
  "taskId": $input.taskId,
  "conversationId": $input.conversationId,
  "userId": $input.userId,
  "stepName": "web_post",
  "sequence": 1,
  "totalSteps": 4
}
```

#### **SEO Task**
```javascript
{
  "provider": $input.provider,
  "model": $input.model,
  "prompt": "Create SEO-optimized content for: " + $input.announcement,
  "temperature": 0.5,              // Lower for SEO
  "maxTokens": 800,
  
  "stepName": "seo_content",
  "sequence": 2,
  "totalSteps": 4
  // ... same status tracking
}
```

#### **Social Media Task**
```javascript
{
  "provider": $input.provider,
  "model": $input.model,
  "prompt": "Create social media posts for: " + $input.announcement + 
           ". Twitter (280 chars), LinkedIn (1300 chars), Facebook (500 chars)",
  "temperature": 0.8,              // Higher for creativity
  "maxTokens": 1200,
  
  "stepName": "social_media",
  "sequence": 3,
  "totalSteps": 4
  // ... same status tracking
}
```

---

### **Input to Marketing Swarm**

**Webhook Body:**
```json
{
  "provider": "openai",              // or "anthropic", "ollama"
  "model": "gpt-4o",
  "announcement": "We're launching our new AI agent platform!",
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "statusWebhook": "http://localhost:7100/webhooks/status"
}
```

---

### **Output from Marketing Swarm**

```json
{
  "webPost": "HTML content for web...",
  "seoContent": "Meta tags, keywords, JSON-LD...",
  "socialMedia": "Twitter: ...\nLinkedIn: ...\nFacebook: ..."
}
```

---

## Key Patterns Identified

### **1. Helper Workflow as Building Block**
- ✅ Reusable across multiple workflows
- ✅ Called via "Execute Workflow" node
- ✅ Accepts flexible parameters
- ✅ Returns normalized output

### **2. Parallel Execution**
- ✅ Multiple Helper calls in parallel
- ✅ Each with different prompts
- ✅ Each with different temperature settings
- ✅ Combine results at the end

### **3. Status Tracking**
- ✅ Optional start/end status webhooks
- ✅ Progress tracking (sequence/totalSteps)
- ✅ Step naming for clarity
- ✅ All status goes to statusWebhook URL

### **4. Flexible Provider Selection**
- ✅ Pass provider as parameter
- ✅ Pass model as parameter
- ✅ Switch handles routing to correct API
- ✅ Normalization ensures consistent output

### **5. Parameter Passing Pattern**
```javascript
// Parent workflow extracts from webhook body
provider: $json.body.provider || 'openai'
model: $json.body.model || 'gpt-4'

// Passes to Helper LLM
provider: $input.provider  // Pass through
model: $input.model        // Pass through
prompt: "Custom prompt for this task"
temperature: 0.7           // Task-specific
maxTokens: 1000            // Task-specific
```

---

## Organization Standards (Extracted)

### **Webhook Defaults**
- Status webhook: `http://host.docker.internal:7100/webhooks/status`
- Paths: `/webhook/workflow-name`

### **Error Handling**
- Use `continueOnFail: true` on status webhooks
- Use `ignoreResponseCode: true` on optional notifications

### **Naming Conventions**
- Workflows: Descriptive names ("Helper: LLM Task", "Marketing Swarm - Flexible LLM")
- Nodes: Action-based ("Send Start Status", "Normalize OpenAI")
- Webhook paths: kebab-case

### **LLM Defaults**
- OpenAI: gpt-4
- Ollama: llama2
- Anthropic: claude-3-sonnet-20240229
- Temperature: 0.7 (general), 0.5 (factual), 0.8 (creative)
- Max tokens: 800-1200 depending on use case

---

## Usage Examples

### **Calling Helper LLM from Another Workflow:**

**Execute Workflow Node Configuration:**
```javascript
{
  "source": "database",
  "workflowId": "9jxl03jCcqg17oOy",  // Helper LLM ID
  "fieldMapping": {
    "fields": [
      { "name": "provider", "value": "anthropic" },
      { "name": "model", "value": "claude-opus-4" },
      { "name": "prompt", "value": "Your prompt here" },
      { "name": "temperature", "value": 0.7 },
      { "name": "maxTokens", "value": 1000 },
      { "name": "sendStartStatus", "value": true },
      { "name": "sendEndStatus", "value": true },
      { "name": "statusWebhook", "value": "http://..." },
      { "name": "taskId", "value": "uuid" },
      { "name": "stepName", "value": "my_step" },
      { "name": "sequence", "value": 1 },
      { "name": "totalSteps", "value": 5 }
    ]
  }
}
```

---

## For `/n8n:create` Command

**The command should know:**

1. ✅ Helper LLM workflow ID: `9jxl03jCcqg17oOy`
2. ✅ How to configure Execute Workflow nodes
3. ✅ Required vs optional parameters
4. ✅ Status tracking pattern
5. ✅ Provider/model defaults
6. ✅ Parallel execution pattern (like Marketing Swarm)
7. ✅ Output normalization expectations

---

**This is brilliant architecture!** The Helper LLM is a perfect abstraction. Ready to build the command? 🚀


# Manual N8N Requirements Writer Setup Guide

Since the automated import requires API keys, here's how to manually create the Requirements Writer workflow in N8N.

## Step-by-Step Setup

### 1. Open N8N Interface
- Go to http://localhost:5678
- You should see the N8N interface

### 2. Create New Workflow
- Click the "+" button or "New workflow"
- You'll see an empty workflow canvas

### 3. Add Webhook Trigger
1. **Add Node**: Click the "+" button on the canvas
2. **Search**: Type "webhook" and select "Webhook"
3. **Configure**:
   - HTTP Method: `POST`
   - Path: `requirements`
   - Response Mode: `Respond to Webhook`
4. **Save**: Click "Save" and note the webhook URL

### 4. Add AI Transform Nodes

#### Node 1: Analyze Request
1. **Add Node**: Click "+" after the webhook
2. **Search**: Type "AI Transform" and select it
3. **Configure**:
   - Instructions: `Analyze the requirements request to understand intent, scope, clarity, urgency, and domain. Return JSON with: intent, scope (small/medium/large/enterprise), clarity (low/medium/high), urgency (low/normal/high/urgent), domain (technical/business/product/operational/other), confidence (0-1), key_indicators (array), missing_info (array), summary (string).`

#### Node 2: Determine Document Type
1. **Add Node**: Connect after "Analyze Request"
2. **Search**: "AI Transform"
3. **Configure**:
   - Instructions: `Based on the analysis, determine the most appropriate document type. Return JSON with: document_type (prd/trd/api/user_story/architecture/general), confidence (0-1), reasoning (string), alternative_types (array), suggested_sections (array).`

#### Node 3: Extract Features
1. **Add Node**: Connect after "Determine Document Type"
2. **Search**: "AI Transform"
3. **Configure**:
   - Instructions: `Extract key features and components from the requirements. Return JSON with: core_features (array), technical_components (array), user_features (array), integrations (array), security_features (array), all_features (array), feature_categories (object), estimated_complexity (low/medium/high), priority_features (array).`

#### Node 4: Assess Complexity
1. **Add Node**: Connect after "Extract Features"
2. **Search**: "AI Transform"
3. **Configure**:
   - Instructions: `Assess the complexity of the requirements. Return JSON with: overall_complexity (low/medium/high/enterprise), complexity_score (number), effort_estimate (string), team_size_recommendation (string), complexity_factors (object), risk_level (low/medium/high/critical), key_challenges (array), recommended_approach (string), technology_recommendations (array), phases (array).`

### 5. Add Document Generation

#### Node 5: Generate Document
1. **Add Node**: Connect after "Assess Complexity"
2. **Search**: "AI Transform"
3. **Configure**:
   - Instructions: `Generate a comprehensive requirements document based on the analysis. Include: 1) Executive Summary, 2) Project Objectives & Scope, 3) Stakeholders & Personas, 4) Functional Requirements, 5) Non-Functional Requirements, 6) Technical Considerations, 7) Risks & Assumptions, 8) Implementation Plan, 9) Success Metrics. Write clearly and concisely for both business and technical audiences.`

### 6. Add Response Node
1. **Add Node**: Connect after "Generate Document"
2. **Search**: "Respond to Webhook"
3. **Configure**:
   - Respond With: `JSON`
   - Response Body: `{{ { "success": true, "response": $json.transformedData, "metadata": { "agentName": "Requirements Writer (N8N)", "processingTime": 1500, "documentType": "general" } } }}`

### 7. Test the Workflow
1. **Activate**: Click the "Activate" toggle
2. **Test**: Use the webhook URL to test
3. **Monitor**: Check the "Executions" tab for results

## Quick Test

Once set up, test with:

```bash
curl -X POST http://localhost:5678/webhook/requirements \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "Create a user authentication system for our mobile app"}'
```

## Troubleshooting

### Common Issues:
1. **AI Transform not working**: Check if AI service is configured in N8N settings
2. **Webhook not responding**: Ensure workflow is activated
3. **JSON parsing errors**: Check the AI Transform instructions format

### Debug Steps:
1. Check workflow execution in N8N
2. Review node outputs
3. Test individual nodes
4. Check error messages

## Alternative: Import JSON File

If you prefer to import the complete workflow:

1. **Download**: Get the workflow file from `/Users/nicholasweber/Sites/orchestrator-ai/apps/n8n/workflows/requirements-writer-enhanced.json`
2. **Import**: In N8N, click "Import from file"
3. **Select**: Choose the downloaded JSON file
4. **Import**: Click "Import"
5. **Activate**: Toggle the workflow to active

This will give you the complete workflow with all nodes and connections pre-configured.


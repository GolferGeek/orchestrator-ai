# Requirements Writer N8N Agent

This document describes the N8N implementation of the Requirements Writer agent, which replicates the functionality of the original TypeScript-based agent using N8N workflows and AI Transform nodes.

## Overview

The N8N Requirements Writer agent provides the same capabilities as the original agent:
- **Requirements Analysis**: Understands intent, scope, clarity, urgency, and domain
- **Document Type Determination**: Selects appropriate document type (PRD, TRD, API, User Stories, Architecture, General)
- **Feature Extraction**: Identifies key features, components, and capabilities
- **Complexity Assessment**: Evaluates project complexity, effort, and risk
- **Document Generation**: Creates comprehensive requirements documents
- **Multiple Document Types**: Supports 6 different document formats

## Workflow Architecture

### Node Structure

1. **Webhook Trigger** - Receives requirements requests
2. **Prepare Input Data** - Processes and validates input
3. **Analyze Request** - AI-powered analysis of requirements
4. **Determine Document Type** - AI selection of appropriate document type
5. **Extract Features** - AI extraction of key features and components
6. **Assess Complexity** - AI assessment of project complexity
7. **Combine Analysis** - Aggregates all analysis results
8. **Document Type Switch** - Routes to appropriate document generator
9. **Document Generators** - 6 specialized AI nodes for different document types
10. **Finalize Document** - Adds metadata and formatting
11. **Respond to Webhook** - Returns the completed document

### Document Types Supported

- **PRD** (Product Requirements Document)
- **TRD** (Technical Requirements Document)  
- **API** (API Requirements Document)
- **User Story** (User Story Document)
- **Architecture** (Architecture Requirements Document)
- **General** (General Requirements Document)

## API Usage

### Endpoint
```
POST http://localhost:5678/webhook/requirements
```

### Request Format
```json
{
  "userMessage": "Create a user authentication system for our mobile app",
  "conversationHistory": [
    {
      "role": "user",
      "content": "I need help with requirements"
    }
  ],
  "mode": "build",
  "planContent": "Optional planning context",
  "sessionId": "optional-session-id"
}
```

### Response Format
```json
{
  "success": true,
  "response": "# Product Requirements Document\n\n## Executive Summary\n...",
  "metadata": {
    "agentName": "Requirements Writer (N8N)",
    "processingTime": 1500,
    "responseType": "prd",
    "analysis": {
      "intent": "requirements_generation",
      "scope": "medium",
      "domain": "technical"
    },
    "documentType": {
      "value": "prd",
      "confidence": 0.85
    },
    "features": {
      "list": ["user authentication", "password reset", "social login"],
      "estimatedComplexity": "medium"
    },
    "complexity": {
      "overall_complexity": "medium",
      "effort_estimate": "3-6 weeks"
    },
    "sections": 10,
    "workflow": {
      "totalSteps": 6,
      "mode": "build"
    }
  }
}
```

## Installation & Setup

### 1. Import Workflow
```bash
# Make script executable
chmod +x apps/n8n/scripts/import-requirements-workflow.sh

# Import the workflow
./apps/n8n/scripts/import-requirements-workflow.sh
```

### 2. Manual Import (Alternative)
1. Open N8N at http://localhost:5678
2. Click "Import from file"
3. Select `apps/n8n/workflows/requirements-writer-enhanced.json`
4. Click "Import"

### 3. Activate Workflow
1. Open the imported workflow in N8N
2. Click "Activate" to enable the webhook
3. Note the webhook URL: `http://localhost:5678/webhook/requirements`

## Configuration

### AI Transform Nodes
Each AI Transform node is configured with specific instructions for its role:

- **Analyze Request**: Analyzes requirements intent, scope, clarity, urgency, domain
- **Determine Document Type**: Selects appropriate document type with reasoning
- **Extract Features**: Identifies core features, technical components, user features
- **Assess Complexity**: Evaluates complexity, effort, risk, and recommendations
- **Document Generators**: Create specialized documents based on type

### Code Nodes
JavaScript code nodes handle:
- **Prepare Input Data**: Input validation and context building
- **Combine Analysis**: Aggregating analysis results
- **Finalize Document**: Adding metadata and formatting

## Testing

### Test Request
```bash
curl -X POST http://localhost:5678/webhook/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Create a user authentication system for our mobile app",
    "mode": "build"
  }'
```

### Expected Response
- Success: 200 with JSON response containing document and metadata
- Error: 500 with error details

## Comparison with Original Agent

### Similarities
- ✅ Same 6-step workflow process
- ✅ Identical document types supported
- ✅ Same analysis capabilities
- ✅ Same metadata structure
- ✅ Same error handling patterns

### Differences
- **Implementation**: N8N workflows vs TypeScript functions
- **AI Integration**: N8N AI Transform nodes vs direct LLM calls
- **Data Flow**: N8N node connections vs function calls
- **Configuration**: N8N UI vs code-based configuration

### Advantages of N8N Version
- **Visual Workflow**: Easy to understand and modify
- **No Code Required**: Configure via N8N interface
- **Built-in Monitoring**: N8N execution monitoring
- **Scalability**: N8N handles concurrent requests
- **Integration**: Easy to connect with other N8N workflows

## Monitoring & Debugging

### N8N Interface
1. Open N8N at http://localhost:5678
2. Navigate to "Executions" tab
3. View workflow execution history
4. Debug failed executions

### Logs
```bash
# View N8N logs
cd apps/n8n && ./manage.sh logs -f
```

### Webhook Testing
```bash
# Test webhook endpoint
curl -X POST http://localhost:5678/webhook/requirements \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "Test requirements"}'
```

## Customization

### Adding New Document Types
1. Add new condition to "Document Type Switch" node
2. Create new AI Transform node for document generation
3. Connect to "Finalize Document" node

### Modifying Analysis Steps
1. Edit AI Transform node instructions
2. Adjust JSON output format
3. Update "Combine Analysis" code node

### Custom Prompts
1. Open AI Transform node
2. Modify "Instructions" field
3. Test with sample data

## Troubleshooting

### Common Issues

1. **Webhook Not Responding**
   - Check if workflow is activated
   - Verify webhook URL is correct
   - Check N8N logs for errors

2. **AI Transform Failures**
   - Verify AI service is configured
   - Check node instructions are clear
   - Review input data format

3. **Document Generation Issues**
   - Ensure document type is correctly determined
   - Check AI Transform node connections
   - Verify finalization step is working

### Debug Steps
1. Check workflow execution in N8N
2. Review node outputs
3. Test individual nodes
4. Check error messages
5. Verify input data format

## Performance Considerations

- **Concurrent Requests**: N8N handles multiple requests automatically
- **AI Processing**: Each AI Transform node processes independently
- **Memory Usage**: Monitor N8N container memory usage
- **Response Time**: Typical response time: 10-30 seconds

## Security

- **Webhook Security**: Consider adding authentication
- **Input Validation**: Validate all input data
- **Rate Limiting**: Implement if needed
- **CORS**: Configure for cross-origin requests

## Future Enhancements

- **Authentication**: Add API key authentication
- **Rate Limiting**: Implement request throttling
- **Caching**: Cache common analysis results
- **Templates**: Add document templates
- **Versioning**: Support document versioning
- **Collaboration**: Add multi-user support

## Support

For issues or questions:
1. Check N8N execution logs
2. Review workflow node outputs
3. Test individual nodes
4. Consult N8N documentation
5. Check OrchestratorAI documentation


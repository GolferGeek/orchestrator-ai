# LLM Evaluation API Documentation

This document describes the API endpoints for LLM (Large Language Model) evaluation, provider management, model selection, and CIDAFM (Context Import Document + AI Function Module) functionality.

## Base URL

```
http://localhost:3001/api
```

## Authentication

All endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## Providers Endpoints

### Get All Providers

Retrieve all available LLM providers.

```http
GET /providers
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "OpenAI",
    "apiBaseUrl": "https://api.openai.com/v1",
    "authType": "api_key",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Provider by ID

Retrieve a specific provider by ID.

```http
GET /providers/{id}
```

**Parameters:**
- `id` (string): Provider UUID

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "OpenAI",
  "apiBaseUrl": "https://api.openai.com/v1",
  "authType": "api_key",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create Provider

Create a new LLM provider.

```http
POST /providers
```

**Request Body:**
```json
{
  "name": "Anthropic",
  "apiBaseUrl": "https://api.anthropic.com",
  "authType": "api_key"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Anthropic",
  "apiBaseUrl": "https://api.anthropic.com",
  "authType": "api_key",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Provider

Update an existing provider.

```http
PUT /providers/{id}
```

**Parameters:**
- `id` (string): Provider UUID

**Request Body:**
```json
{
  "name": "OpenAI Updated",
  "status": "inactive"
}
```

### Delete Provider

Delete a provider (only if no models are associated).

```http
DELETE /providers/{id}
```

**Parameters:**
- `id` (string): Provider UUID

---

## Models Endpoints

### Get All Models

Retrieve all available models with optional filtering.

```http
GET /models?providerId={providerId}&status={status}&supportsThinking={boolean}&includeProvider={boolean}
```

**Query Parameters:**
- `providerId` (optional): Filter by provider UUID
- `status` (optional): Filter by status (`active`, `inactive`)
- `supportsThinking` (optional): Filter by thinking support (`true`, `false`)
- `includeProvider` (optional): Include provider details (`true`, `false`)

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "GPT-4o",
    "modelId": "gpt-4o",
    "providerId": "550e8400-e29b-41d4-a716-446655440001",
    "pricingInputPer1k": 0.005,
    "pricingOutputPer1k": 0.015,
    "maxTokens": 128000,
    "contextWindow": 128000,
    "supportsThinking": false,
    "strengths": ["reasoning", "coding", "analysis"],
    "weaknesses": ["cost", "speed"],
    "useCases": ["complex-analysis", "coding", "research"],
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "provider": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "OpenAI"
    }
  }
]
```

### Get Model by ID

Retrieve a specific model by ID.

```http
GET /models/{id}?includeProvider={boolean}
```

**Parameters:**
- `id` (string): Model UUID
- `includeProvider` (optional): Include provider details

### Find Model by Model ID

Find a model by its model identifier (e.g., "gpt-4o").

```http
GET /models/by-model-id/{modelId}?providerId={providerId}
```

**Parameters:**
- `modelId` (string): Model identifier (e.g., "gpt-4o")
- `providerId` (optional): Provider UUID for disambiguation

### Create Model

Create a new model.

```http
POST /models
```

**Request Body:**
```json
{
  "providerId": "550e8400-e29b-41d4-a716-446655440001",
  "name": "GPT-4o-mini",
  "modelId": "gpt-4o-mini",
  "pricingInputPer1k": 0.00015,
  "pricingOutputPer1k": 0.0006,
  "maxTokens": 128000,
  "contextWindow": 128000,
  "supportsThinking": false,
  "strengths": ["speed", "cost-effective"],
  "weaknesses": ["reasoning-depth"],
  "useCases": ["chat", "simple-tasks", "testing"]
}
```

### Update Model

Update an existing model.

```http
PUT /models/{id}
```

**Parameters:**
- `id` (string): Model UUID

**Request Body:**
```json
{
  "name": "GPT-4o Updated",
  "pricingInputPer1k": 0.004,
  "status": "inactive"
}
```

### Delete Model

Delete a model (only if no usage history exists).

```http
DELETE /models/{id}
```

### Estimate Cost

Estimate the cost for a given input with a specific model.

```http
POST /models/estimate-cost
```

**Request Body:**
```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440010",
  "content": "This is the input text to estimate cost for processing.",
  "responseLengthFactor": 1.5
}
```

**Response:**
```json
{
  "estimatedInputTokens": 12,
  "estimatedOutputTokens": 18,
  "estimatedCost": 0.00033,
  "currency": "USD",
  "model": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "GPT-4o",
    "pricingInputPer1k": 0.005,
    "pricingOutputPer1k": 0.015
  },
  "maxCostWarning": "This operation may cost more than $0.10. Estimated: $0.0003"
}
```

### Get Model Recommendations

Get model recommendations based on use case and constraints.

```http
GET /models/recommendations?useCase={useCase}&maxCost={maxCost}&minContext={minContext}
```

**Query Parameters:**
- `useCase` (required): Use case type (`chat`, `coding`, `analysis`, `research`)
- `maxCost` (optional): Maximum cost per 1k output tokens
- `minContext` (optional): Minimum context window size

---

## CIDAFM Endpoints

### Get All Commands

Retrieve all available CIDAFM commands.

```http
GET /cidafm/commands?type={type}&isBuiltin={boolean}&isActive={boolean}
```

**Query Parameters:**
- `type` (optional): Command type (`^`, `&`, `!`)
- `isBuiltin` (optional): Filter built-in commands (`true`, `false`)
- `isActive` (optional): Filter active commands (`true`, `false`)

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "name": "concise",
    "type": "^",
    "description": "Make responses more concise and to the point",
    "example": "^concise Please provide a brief summary",
    "isBuiltin": true,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Command by ID

Retrieve a specific CIDAFM command.

```http
GET /cidafm/commands/{id}
```

### Create Command

Create a new CIDAFM command.

```http
POST /cidafm/commands
```

**Request Body:**
```json
{
  "name": "detailed",
  "type": "^",
  "description": "Provide detailed and comprehensive responses",
  "example": "^detailed Explain the concept in detail"
}
```

### Update Command

Update an existing CIDAFM command.

```http
PUT /cidafm/commands/{id}
```

### Delete Command

Delete a CIDAFM command (only custom commands).

```http
DELETE /cidafm/commands/{id}
```

### Process Message

Process a message with CIDAFM commands and modifiers.

```http
POST /cidafm/process
```

**Request Body:**
```json
{
  "message": "^concise &friendly Please explain quantum computing",
  "activeCommands": ["concise", "friendly"],
  "customModifiers": ["use simple language"],
  "contextOptions": {
    "preserveFormatting": true,
    "allowOverrides": true
  }
}
```

**Response:**
```json
{
  "modifiedPrompt": "Please explain quantum computing. [Be concise and use a friendly tone. Use simple language.]",
  "activeStateModifiers": ["friendly"],
  "executedCommands": ["concise"],
  "processingNotes": ["Applied concise formatting", "Added friendly tone modifier"],
  "detectedCommands": [
    {
      "type": "^",
      "name": "concise",
      "position": 0
    },
    {
      "type": "&",
      "name": "friendly",
      "position": 9
    }
  ]
}
```

---

## LLM Enhanced Messaging

### Generate Enhanced Response

Generate an LLM response with provider/model selection and CIDAFM processing.

```http
POST /llms/enhanced-response
```

**Request Body:**
```json
{
  "message": "^concise Explain machine learning",
  "llmSelection": {
    "providerId": "550e8400-e29b-41d4-a716-446655440001",
    "modelId": "550e8400-e29b-41d4-a716-446655440010",
    "temperature": 0.7,
    "maxTokens": 1000,
    "cidafmOptions": {
      "activeStateModifiers": ["professional"],
      "responseModifiers": ["concise"],
      "executedCommands": ["concise"],
      "customOptions": {
        "customModifiers": ["use examples"],
        "temperatureOverride": 0.8
      }
    }
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "userId": "user-123",
  "userMessage": "Explain machine learning",
  "processedMessage": "Explain machine learning. [Be concise.]",
  "assistantResponse": "Machine learning is a subset of AI that enables computers to learn and make decisions from data without explicit programming...",
  "providerId": "550e8400-e29b-41d4-a716-446655440001",
  "modelId": "550e8400-e29b-41d4-a716-446655440010",
  "inputTokens": 8,
  "outputTokens": 145,
  "totalCost": 0.002215,
  "responseTimeMs": 1240,
  "cidafmProcessing": {
    "modifiedPrompt": "Explain machine learning. [Be concise.]",
    "activeStateModifiers": ["professional"],
    "executedCommands": ["concise"],
    "processingNotes": ["Applied concise formatting"]
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Usage and Analytics Endpoints

### Get User Stats

Get comprehensive usage statistics for a user.

```http
GET /usage/stats?startDate={startDate}&endDate={endDate}&providerId={providerId}&modelId={modelId}&includeDetails={boolean}
```

**Query Parameters:**
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `providerId` (optional): Filter by provider
- `modelId` (optional): Filter by model
- `includeDetails` (optional): Include detailed breakdowns

**Response:**
```json
{
  "userId": "user-123",
  "dateRange": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "totalRequests": 150,
  "totalTokens": 45000,
  "totalCost": 2.35,
  "averageResponseTime": 1250.5,
  "averageUserRating": 4.2,
  "byProvider": [
    {
      "provider": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "OpenAI"
      },
      "requests": 120,
      "tokens": 36000,
      "cost": 1.80,
      "avgRating": 4.3
    }
  ],
  "byModel": [
    {
      "model": {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "name": "GPT-4o"
      },
      "requests": 75,
      "tokens": 25000,
      "cost": 1.25,
      "avgRating": 4.5
    }
  ],
  "dailyStats": [
    {
      "date": "2024-01-15",
      "requests": 5,
      "tokens": 1500,
      "cost": 0.075
    }
  ]
}
```

### Get Cost Summary

Get cost breakdown and trends.

```http
GET /usage/cost-summary?startDate={startDate}&endDate={endDate}&groupBy={groupBy}
```

**Query Parameters:**
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `groupBy` (optional): Group by (`provider`, `model`, `day`)

### Get Model Performance

Get model performance rankings and metrics.

```http
GET /usage/model-performance?minUsage={minUsage}&sortBy={sortBy}
```

**Query Parameters:**
- `minUsage` (optional): Minimum usage threshold
- `sortBy` (optional): Sort criteria (`rating`, `cost`, `usage`, `speed`)

### Get Spending Insights

Get AI-powered spending insights and recommendations.

```http
GET /usage/spending-insights/{lookbackDays}
```

**Parameters:**
- `lookbackDays` (number): Number of days to analyze

### Get Budget Status

Get current budget status and alerts.

```http
GET /usage/budget-status?monthlyBudget={budget}
```

**Query Parameters:**
- `monthlyBudget` (optional): Monthly budget limit (default: $100)

### Export Usage Data

Export usage data in various formats.

```http
GET /usage/export?format={format}&startDate={startDate}&endDate={endDate}
```

**Query Parameters:**
- `format` (optional): Export format (`json`, `csv`) (default: `json`)
- `startDate` (optional): Start date
- `endDate` (optional): End date

---

## Error Responses

All endpoints return standard HTTP status codes and error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Provider not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Model ID already exists for this provider",
  "error": "Conflict"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Failed to fetch models: Database connection failed",
  "error": "Internal Server Error"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General endpoints**: 100 requests per minute per user
- **LLM processing endpoints**: 20 requests per minute per user
- **Export endpoints**: 5 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Data Types

### Provider Status
- `active`: Provider is available for use
- `inactive`: Provider is temporarily disabled
- `deprecated`: Provider is being phased out

### Model Status
- `active`: Model is available for use
- `inactive`: Model is temporarily disabled
- `beta`: Model is in beta testing
- `deprecated`: Model is being phased out

### Auth Types
- `api_key`: API key authentication
- `oauth`: OAuth 2.0 authentication
- `bearer`: Bearer token authentication

### CIDAFM Command Types
- `^`: Response modifiers (affect output format/style)
- `&`: State modifiers (affect AI personality/tone)
- `!`: Execution commands (trigger specific behaviors)

### Use Cases
- `chat`: General conversation
- `coding`: Programming and development
- `analysis`: Data analysis and insights
- `research`: Research and fact-finding
- `creative`: Creative writing and content
- `simple-tasks`: Basic tasks and questions

---

## Examples

### Complete LLM Interaction Flow

1. **Get available providers and models:**
```bash
curl -X GET "http://localhost:3001/api/providers" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl -X GET "http://localhost:3001/api/models?includeProvider=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Estimate cost for a message:**
```bash
curl -X POST "http://localhost:3001/api/models/estimate-cost" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "550e8400-e29b-41d4-a716-446655440010",
    "content": "Explain quantum computing",
    "responseLengthFactor": 2.0
  }'
```

3. **Send enhanced message with CIDAFM:**
```bash
curl -X POST "http://localhost:3001/api/llms/enhanced-response" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "^concise &professional Explain quantum computing",
    "llmSelection": {
      "providerId": "550e8400-e29b-41d4-a716-446655440001",
      "modelId": "550e8400-e29b-41d4-a716-446655440010",
      "temperature": 0.7,
      "maxTokens": 500
    }
  }'
```

4. **Check usage stats:**
```bash
curl -X GET "http://localhost:3001/api/usage/stats?includeDetails=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This API provides a comprehensive interface for managing LLM providers, models, CIDAFM commands, and tracking usage analytics for AI-powered applications.
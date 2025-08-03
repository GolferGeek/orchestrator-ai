# LLM Evaluation Enhancements PRD

## Overview

This PRD outlines the implementation of comprehensive LLM provider/model selection capabilities and evaluation framework for the Orchestrator AI system. Users will be able to choose from multiple LLM providers and models, apply CIDAFM (AI Function Module) constraints, and evaluate responses with detailed metrics and cost tracking.

## Problem Statement

Currently, the Orchestrator AI system uses a fixed LLM configuration without user control over:
- LLM provider and model selection
- AI behavior modification through structured prompts
- Response evaluation and performance tracking  
- Cost transparency and usage analytics

## Goals

### Primary Goals
1. **LLM Selection**: Enable users to choose from multiple providers (OpenAI, Anthropic, etc.) and models
2. **CIDAFM Integration**: Allow users to apply AI Function Modules for behavior modification
3. **Evaluation Framework**: Provide comprehensive response evaluation with user ratings and metrics
4. **Cost Transparency**: Show real-time costs and usage analytics
5. **Performance Tracking**: Monitor response times, accuracy, and user satisfaction

### Secondary Goals
- Maintain backward compatibility with existing conversations
- Integrate with existing LangSmith observability
- Support future LLM providers and models easily
- Enable data-driven model selection recommendations

## Success Metrics

- **User Engagement**: 80% of users try different LLM providers within first week
- **Evaluation Adoption**: 60% of messages receive user ratings within 2 weeks
- **Cost Awareness**: Users report improved understanding of LLM costs
- **Performance**: No degradation in response times with new features

## User Stories

### LLM Provider Selection
- As a user, I want to select my preferred LLM provider and model before sending a message
- As a user, I want to see estimated costs before sending expensive queries
- As a user, I want to compare different models' performance on similar tasks

### CIDAFM Behavior Modification
- As a user, I want to apply response modifiers (^) for single-use behavior changes
- As a user, I want to toggle state modifiers (&) for persistent conversation behavior
- As a user, I want to execute commands (!) for specific actions
- As a user, I want to create custom AFMs for my specific use cases

### Evaluation & Analytics
- As a user, I want to rate responses on speed, accuracy, and overall quality
- As a user, I want to add notes about response quality for future reference
- As a user, I want to view my usage statistics and spending patterns
- As a user, I want to see which models perform best for different types of queries

## Technical Requirements

### Database Schema Changes

#### New Tables
```sql
-- LLM Providers
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    api_base_url VARCHAR(255),
    auth_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- LLM Models
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES providers(id),
    name VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    pricing_input_per_1k DECIMAL(10,6),
    pricing_output_per_1k DECIMAL(10,6),
    supports_thinking BOOLEAN DEFAULT false,
    max_tokens INTEGER,
    context_window INTEGER,
    strengths TEXT[],
    weaknesses TEXT[],
    use_cases TEXT[],
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- CIDAFM Commands
CREATE TABLE cidafm_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(1) NOT NULL CHECK (type IN ('^', '&', '!')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_active BOOLEAN DEFAULT false,
    is_builtin BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Custom CIDAFM Commands
CREATE TABLE user_cidafm_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(1) NOT NULL CHECK (type IN ('^', '&', '!')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Usage Statistics
CREATE TABLE user_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    provider_id UUID REFERENCES providers(id),
    model_id UUID REFERENCES models(id),
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    avg_response_time_ms INTEGER,
    avg_user_rating DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Enhanced Messages Table
```sql
ALTER TABLE messages ADD COLUMN provider_id UUID REFERENCES providers(id);
ALTER TABLE messages ADD COLUMN model_id UUID REFERENCES models(id);
ALTER TABLE messages ADD COLUMN input_tokens INTEGER;
ALTER TABLE messages ADD COLUMN output_tokens INTEGER;
ALTER TABLE messages ADD COLUMN total_cost DECIMAL(10,6);
ALTER TABLE messages ADD COLUMN response_time_ms INTEGER;
ALTER TABLE messages ADD COLUMN langsmith_run_id VARCHAR(255);
ALTER TABLE messages ADD COLUMN user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5);
ALTER TABLE messages ADD COLUMN speed_rating INTEGER CHECK (speed_rating BETWEEN 1 AND 5);
ALTER TABLE messages ADD COLUMN accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5);
ALTER TABLE messages ADD COLUMN user_notes TEXT;
ALTER TABLE messages ADD COLUMN evaluation_timestamp TIMESTAMP;
ALTER TABLE messages ADD COLUMN cidafm_options JSONB;
ALTER TABLE messages ADD COLUMN evaluation_details JSONB;
```

### API Enhancements

#### New Endpoints
- `GET /api/providers` - List available LLM providers
- `GET /api/models` - List available models (with optional provider filter)
- `GET /api/cidafm/commands` - List available CIDAFM commands
- `POST /api/cidafm/commands` - Create custom CIDAFM command
- `GET /api/usage/stats` - Get user usage statistics
- `POST /api/messages/:id/evaluate` - Submit message evaluation

#### Enhanced Endpoints
- `POST /api/sessions/:id/messages` - Accept LLM selection and CIDAFM options
- `GET /api/sessions/:id/messages` - Include evaluation data in response

### Frontend Components

#### New Components
- `LLMProviderSelector` - Dropdown for provider selection
- `LLMModelSelector` - Dropdown for model selection with pricing info
- `CIDAFMControls` - Interface for AFM selection and custom input
- `MessageEvaluation` - Rating interface for messages
- `UsageAnalytics` - Dashboard for usage statistics
- `CostEstimator` - Real-time cost calculation display

#### Enhanced Components
- `ChatInput` - Integrate LLM and CIDAFM controls
- `MessageItem` - Show LLM info and evaluation interface
- `App.vue` - Add usage analytics navigation

### Backend Services

#### Enhanced Services
- `OrchestatorService` - Pass LLM preferences to sub-agents
- `LLMService` - Support dynamic provider/model selection
- `MessageService` - Handle evaluation data and cost tracking

#### New Services
- `CIDAFMService` - Process AFM commands and modify prompts
- `EvaluationService` - Manage ratings and analytics
- `UsageTrackingService` - Calculate and store usage statistics

## User Experience Flow

### Message Creation Flow
1. User opens chat interface
2. User selects LLM provider and model (with cost estimate)
3. User configures CIDAFM options (optional)
4. User types message and sees estimated cost
5. User sends message
6. System shows actual cost and response time
7. User can rate the response and add notes

### Evaluation Flow
1. Message appears with evaluation interface
2. User rates overall quality (1-5 stars)
3. User rates speed and accuracy (optional)
4. User adds notes (optional)
5. System stores evaluation data
6. Analytics dashboard updates with new data

## Implementation Plan

### Phase 1: Database Foundation (Week 1)
- Create database migration with all new tables
- Seed initial providers and models data
- Populate built-in CIDAFM commands
- Add RLS policies for new tables

### Phase 2: Backend API (Week 2-3)
- Implement new API endpoints
- Enhance existing endpoints with new data
- Update DTOs and types
- Add validation for LLM and CIDAFM parameters

### Phase 3: LLM Service Integration (Week 3-4)
- Extend LLM service for dynamic provider/model selection
- Implement CIDAFM prompt modification logic
- Add cost calculation and token counting
- Integrate with LangSmith for observability

### Phase 4: Frontend Components (Week 4-5)
- Build LLM selection components
- Create CIDAFM controls interface
- Implement evaluation UI
- Add usage analytics dashboard

### Phase 5: Integration & Testing (Week 5-6)
- Wire frontend to backend APIs
- End-to-end testing of all features
- Performance optimization
- Bug fixes and polish

## Risk Mitigation

### Technical Risks
- **Database migration complexity**: Thorough testing in staging environment
- **LLM service reliability**: Implement fallback mechanisms and retry logic
- **Performance impact**: Monitor response times and optimize queries

### User Experience Risks
- **Feature complexity**: Provide sensible defaults and progressive disclosure
- **Cost shock**: Clear cost estimates and spending limits
- **Evaluation fatigue**: Make ratings optional and quick

## Success Criteria

### Functional Requirements
- [ ] Users can select from multiple LLM providers and models
- [ ] CIDAFM commands modify AI behavior as specified
- [ ] Cost tracking is accurate within 5%
- [ ] Evaluation data is captured and stored correctly
- [ ] Analytics dashboard provides actionable insights

### Non-Functional Requirements
- [ ] Response times increase by no more than 200ms
- [ ] System handles 10x current message volume
- [ ] 99.9% uptime maintained
- [ ] All sensitive data properly encrypted
- [ ] GDPR compliance for evaluation data

## Future Enhancements

### Phase 2 Features
- Advanced CIDAFM custom command builder
- Model performance recommendations based on usage
- Cost budgeting and alerts
- Team usage analytics and sharing
- Integration with additional LLM providers

### Phase 3 Features
- A/B testing framework for model comparison
- Automated model selection based on query type
- Advanced analytics with ML insights
- Export capabilities for evaluation data
- API access for programmatic usage

## Appendix

### CIDAFM Command Reference
See [CID_AFM.md](./CID_AFM.md) for complete specification.

### LLM Provider Integration
Initial providers to support:
- OpenAI (GPT-4, GPT-3.5-turbo)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Haiku)
- Google (Gemini Pro, Gemini Flash)
- Additional providers as needed

### Cost Calculation Formula
```
total_cost = (input_tokens / 1000) * input_price + (output_tokens / 1000) * output_price
```

---

*This PRD is a living document and will be updated as requirements evolve during implementation.*
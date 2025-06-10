#!/usr/bin/env python3
"""
Requirements Writer Agent Function

This Python script handles requirements writing tasks by processing user requests
and generating comprehensive technical documentation.
"""

import sys
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime


class RequirementsWriter:
    """Main class for processing requirements writing requests"""
    
    def __init__(self):
        self.document_templates = {
            'prd': self._generate_prd_template,
            'trd': self._generate_trd_template,
            'api': self._generate_api_template,
            'user_story': self._generate_user_story_template,
            'architecture': self._generate_architecture_template
        }
    
    def process_request(self, user_message: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Process the requirements writing request"""
        
        # Analyze the request to determine document type and scope
        analysis = self._analyze_request(user_message)
        
        # Generate the appropriate document
        document = self._generate_document(analysis, user_message, metadata)
        
        return {
            "response": document,
            "analysis": analysis,
            "metadata": {
                "document_type": analysis.get('document_type', 'general'),
                "complexity": analysis.get('complexity', 'medium'),
                "estimated_effort": analysis.get('estimated_effort', 'unknown'),
                "generated_at": datetime.now().isoformat()
            }
        }
    
    def _analyze_request(self, user_message: str) -> Dict[str, Any]:
        """Analyze the user request to determine document type and scope"""
        
        message_lower = user_message.lower()
        
        # Determine document type
        document_type = 'general'
        if any(keyword in message_lower for keyword in ['prd', 'product requirements']):
            document_type = 'prd'
        elif any(keyword in message_lower for keyword in ['trd', 'technical requirements']):
            document_type = 'trd'
        elif any(keyword in message_lower for keyword in ['api', 'endpoint', 'rest', 'swagger']):
            document_type = 'api'
        elif any(keyword in message_lower for keyword in ['user story', 'user stories', 'acceptance criteria']):
            document_type = 'user_story'
        elif any(keyword in message_lower for keyword in ['architecture', 'system design', 'components']):
            document_type = 'architecture'
        
        # Determine complexity
        complexity = 'medium'
        if any(keyword in message_lower for keyword in ['simple', 'basic', 'minimal']):
            complexity = 'low'
        elif any(keyword in message_lower for keyword in ['complex', 'enterprise', 'scalable', 'distributed']):
            complexity = 'high'
        
        # Extract key features/components
        features = self._extract_features(user_message)
        
        return {
            'document_type': document_type,
            'complexity': complexity,
            'features': features,
            'estimated_effort': self._estimate_effort(complexity, len(features))
        }
    
    def _extract_features(self, user_message: str) -> List[str]:
        """Extract key features and components from the user message"""
        
        # Common feature patterns
        feature_patterns = [
            r'authentication',
            r'authorization',
            r'user management',
            r'database',
            r'api',
            r'ui',
            r'dashboard',
            r'reporting',
            r'notification',
            r'search',
            r'filtering',
            r'pagination',
            r'file upload',
            r'real-time',
            r'integration',
            r'security',
            r'logging',
            r'monitoring'
        ]
        
        features = []
        message_lower = user_message.lower()
        
        for pattern in feature_patterns:
            if re.search(pattern, message_lower):
                features.append(pattern.replace('_', ' ').title())
        
        return features
    
    def _estimate_effort(self, complexity: str, feature_count: int) -> str:
        """Estimate development effort based on complexity and features"""
        
        base_effort = {
            'low': 1,
            'medium': 3,
            'high': 8
        }
        
        total_effort = base_effort.get(complexity, 3) + (feature_count * 0.5)
        
        if total_effort <= 2:
            return 'Small (1-2 weeks)'
        elif total_effort <= 6:
            return 'Medium (3-6 weeks)'
        elif total_effort <= 12:
            return 'Large (7-12 weeks)'
        else:
            return 'Extra Large (3+ months)'
    
    def _generate_document(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate the appropriate document based on analysis"""
        
        document_type = analysis.get('document_type', 'general')
        
        if document_type in self.document_templates:
            return self.document_templates[document_type](analysis, user_message, metadata)
        else:
            return self._generate_general_requirements(analysis, user_message, metadata)
    
    def _generate_prd_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate Product Requirements Document"""
        
        features = analysis.get('features', [])
        complexity = analysis.get('complexity', 'medium')
        
        return f"""# Product Requirements Document

## 1. Executive Summary
Based on your request: "{user_message}"

This document outlines the requirements for implementing the requested product features with {complexity} complexity.

## 2. Product Overview
- **Estimated Effort**: {analysis.get('estimated_effort', 'Unknown')}
- **Complexity Level**: {complexity.title()}
- **Key Features**: {len(features)} identified features

## 3. Functional Requirements

### 3.1 Core Features
{self._format_feature_list(features)}

### 3.2 User Stories
{self._generate_user_stories(features)}

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- Response time: < 200ms for API calls
- Throughput: Support 1000+ concurrent users
- Availability: 99.9% uptime

### 4.2 Security Requirements
- Authentication: Multi-factor authentication
- Authorization: Role-based access control
- Data encryption: AES-256 for sensitive data
- HTTPS/TLS 1.3 for all communications

### 4.3 Scalability Requirements
- Horizontal scaling capability
- Database sharding support
- CDN integration for static assets

## 5. Technical Specifications

### 5.1 Technology Stack
- Backend: Node.js with TypeScript/NestJS
- Frontend: Vue.js 3 with TypeScript
- Database: PostgreSQL with Redis caching
- Infrastructure: Docker + Kubernetes

### 5.2 API Requirements
- RESTful API design
- OpenAPI 3.0 specification
- JSON request/response format
- Comprehensive error handling

## 6. Implementation Timeline
{self._generate_timeline(complexity)}

## 7. Acceptance Criteria
{self._generate_acceptance_criteria(features)}

## 8. Risk Assessment
- **Technical Risks**: {self._assess_technical_risks(complexity)}
- **Timeline Risks**: {self._assess_timeline_risks(complexity)}
- **Resource Risks**: Adequate development team size required

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_trd_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate Technical Requirements Document"""
        
        features = analysis.get('features', [])
        complexity = analysis.get('complexity', 'medium')
        
        return f"""# Technical Requirements Document

## 1. Technical Overview
Request: "{user_message}"

This document provides detailed technical specifications for implementation.

## 2. System Architecture

### 2.1 High-Level Architecture
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │────│   Backend   │────│  Database   │
│   (Vue.js)  │    │  (NestJS)   │    │(PostgreSQL)│
└─────────────┘    └─────────────┘    └─────────────┘
```

### 2.2 Component Breakdown
{self._generate_technical_components(features)}

## 3. Data Models

### 3.1 Database Schema
{self._generate_database_schema(features)}

### 3.2 API Schemas
{self._generate_api_schemas(features)}

## 4. Technical Implementation

### 4.1 Backend Services
{self._generate_backend_services(features)}

### 4.2 Frontend Components
{self._generate_frontend_components(features)}

### 4.3 Integration Points
{self._generate_integration_points(features)}

## 5. Security Implementation

### 5.1 Authentication Flow
1. User submits credentials
2. Server validates against database
3. JWT token generated and returned
4. Token used for subsequent requests

### 5.2 Authorization Matrix
{self._generate_authorization_matrix(features)}

## 6. Error Handling
{self._generate_error_handling_spec()}

## 7. Testing Strategy
{self._generate_testing_strategy(complexity)}

## 8. Deployment Requirements
{self._generate_deployment_requirements()}

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_api_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate API Documentation"""
        
        features = analysis.get('features', [])
        
        return f"""# API Specification

## Overview
API specification for: "{user_message}"

## Base Configuration
- **Base URL**: `https://api.example.com/v1`
- **Authentication**: Bearer token (JWT)
- **Content Type**: `application/json`
- **API Version**: v1

## Endpoints

{self._generate_api_endpoints(features)}

## Authentication
```http
POST /auth/login
Content-Type: application/json

{{
  "email": "user@example.com",
  "password": "securepassword"
}}
```

Response:
```json
{{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expires_in": 3600
}}
```

## Error Responses
{self._generate_api_error_responses()}

## Rate Limiting
- 1000 requests per hour per user
- 100 requests per minute per endpoint

## SDK Examples

### JavaScript/TypeScript
```typescript
import {{ ApiClient }} from '@company/api-client';

const client = new ApiClient({{
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'your-api-key'
}});

// Example usage
const result = await client.getData();
```

### Python
```python
import requests

headers = {{
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
}}

response = requests.get('https://api.example.com/v1/data', headers=headers)
```

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_user_story_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate User Stories with Acceptance Criteria"""
        
        features = analysis.get('features', [])
        
        return f"""# User Stories and Acceptance Criteria

## Project Context
Based on: "{user_message}"

## Epic Overview
As a product stakeholder, I want to implement the requested functionality so that users can achieve their goals efficiently.

## User Stories

{self._generate_detailed_user_stories(features)}

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Security review passed
- [ ] Performance testing completed
- [ ] Deployed to staging environment
- [ ] User acceptance testing completed

## Story Dependencies
{self._generate_story_dependencies(features)}

## Estimation Guidelines
- **Story Points**: Using Fibonacci sequence (1, 2, 3, 5, 8, 13)
- **Velocity**: Estimated team velocity needed
- **Sprint Planning**: Recommended story distribution

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_architecture_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate System Architecture Document"""
        
        features = analysis.get('features', [])
        complexity = analysis.get('complexity', 'medium')
        
        return f"""# System Architecture Document

## 1. Architecture Overview
System design for: "{user_message}"

## 2. Architecture Principles
- **Scalability**: Horizontal scaling with microservices
- **Reliability**: 99.9% uptime with redundancy
- **Security**: Defense in depth strategy
- **Maintainability**: Clean code and documentation
- **Performance**: Sub-200ms response times

## 3. System Components

### 3.1 Frontend Layer
{self._generate_frontend_architecture(features)}

### 3.2 API Gateway
- Authentication and authorization
- Rate limiting and throttling
- Request routing and load balancing
- API versioning and documentation

### 3.3 Microservices
{self._generate_microservices_architecture(features)}

### 3.4 Data Layer
{self._generate_data_architecture(features)}

## 4. Infrastructure Architecture

### 4.1 Cloud Services
- **Compute**: Kubernetes clusters
- **Storage**: PostgreSQL + Redis + S3
- **Networking**: Load balancers + CDN
- **Monitoring**: Prometheus + Grafana

### 4.2 Deployment Pipeline
```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│    Dev     │────│   Build    │────│    Test    │────│    Prod    │
│ Environment│    │  Pipeline  │    │   Suite    │    │ Deployment │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

## 5. Security Architecture
{self._generate_security_architecture()}

## 6. Monitoring and Observability
{self._generate_monitoring_architecture()}

## 7. Disaster Recovery
{self._generate_disaster_recovery_plan()}

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_general_requirements(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate general requirements document"""
        
        features = analysis.get('features', [])
        complexity = analysis.get('complexity', 'medium')
        
        return f"""# Requirements Specification

## Project Overview
Request: "{user_message}"

## Analysis Summary
- **Document Type**: General Requirements
- **Complexity**: {complexity.title()}
- **Identified Features**: {len(features)}
- **Estimated Effort**: {analysis.get('estimated_effort', 'Unknown')}

## Requirements Breakdown

### Functional Requirements
{self._format_feature_list(features)}

### Technical Requirements
1. **Performance**: System should handle expected load efficiently
2. **Security**: Implement appropriate security measures
3. **Scalability**: Design for future growth
4. **Maintainability**: Code should be well-documented and testable

### Implementation Recommendations
{self._generate_implementation_recommendations(complexity)}

## Next Steps
1. **Detailed Analysis**: Conduct deeper technical analysis
2. **Prototyping**: Create proof of concept
3. **Resource Planning**: Allocate development resources
4. **Timeline Planning**: Create detailed project timeline

## Questions for Clarification
{self._generate_clarification_questions(user_message)}

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    # Helper methods for generating specific sections
    
    def _format_feature_list(self, features: List[str]) -> str:
        if not features:
            return "- Core functionality as described in the request"
        return "\n".join([f"- {feature}" for feature in features])
    
    def _generate_user_stories(self, features: List[str]) -> str:
        if not features:
            return "**US001**: As a user, I want to use the system so that I can accomplish my goals."
        
        stories = []
        for i, feature in enumerate(features, 1):
            stories.append(f"**US{i:03d}**: As a user, I want {feature.lower()} functionality so that I can benefit from this capability.")
        
        return "\n".join(stories)
    
    def _generate_detailed_user_stories(self, features: List[str]) -> str:
        if not features:
            return self._default_user_story()
        
        stories = []
        for i, feature in enumerate(features, 1):
            story = f"""
### US{i:03d}: {feature} Feature

**As a** user  
**I want** to use {feature.lower()} functionality  
**So that** I can accomplish my specific goals  

**Acceptance Criteria:**
- [ ] User can access {feature.lower()} functionality
- [ ] System provides appropriate feedback
- [ ] Error conditions are handled gracefully
- [ ] Performance meets requirements

**Story Points:** TBD  
**Priority:** Medium  
"""
            stories.append(story)
        
        return "\n".join(stories)
    
    def _default_user_story(self) -> str:
        return """
### US001: Core Functionality

**As a** user  
**I want** to use the core system functionality  
**So that** I can accomplish my primary goals  

**Acceptance Criteria:**
- [ ] User can access main features
- [ ] System provides clear feedback
- [ ] Error conditions are handled
- [ ] Performance is acceptable

**Story Points:** TBD  
**Priority:** High  
"""
    
    def _generate_timeline(self, complexity: str) -> str:
        timelines = {
            'low': "- Sprint 1-2: Core implementation\n- Sprint 3: Testing and refinement",
            'medium': "- Sprint 1-2: Foundation and core features\n- Sprint 3-4: Advanced features\n- Sprint 5: Testing and deployment",
            'high': "- Phase 1 (Sprints 1-4): Core platform\n- Phase 2 (Sprints 5-8): Advanced features\n- Phase 3 (Sprints 9-12): Optimization and deployment"
        }
        return timelines.get(complexity, timelines['medium'])
    
    def _generate_acceptance_criteria(self, features: List[str]) -> str:
        criteria = [
            "- All functional requirements are implemented and tested",
            "- Non-functional requirements are met",
            "- Security requirements are satisfied",
            "- Performance benchmarks are achieved",
            "- Documentation is complete and accurate"
        ]
        
        if features:
            for feature in features:
                criteria.append(f"- {feature} functionality works as specified")
        
        return "\n".join(criteria)
    
    def _assess_technical_risks(self, complexity: str) -> str:
        risks = {
            'low': "Minimal technical risks",
            'medium': "Moderate complexity requiring careful planning",
            'high': "High complexity with integration challenges"
        }
        return risks.get(complexity, risks['medium'])
    
    def _assess_timeline_risks(self, complexity: str) -> str:
        risks = {
            'low': "Low risk of timeline slippage",
            'medium': "Moderate risk requiring active management",
            'high': "High risk requiring buffer time and contingency planning"
        }
        return risks.get(complexity, risks['medium'])
    
    def _generate_technical_components(self, features: List[str]) -> str:
        components = [
            "- **Authentication Service**: User login and session management",
            "- **Business Logic Layer**: Core application functionality",
            "- **Data Access Layer**: Database operations and caching",
            "- **API Layer**: REST endpoints and request handling"
        ]
        
        for feature in features:
            if 'notification' in feature.lower():
                components.append("- **Notification Service**: Email and push notifications")
            if 'search' in feature.lower():
                components.append("- **Search Service**: Full-text search capabilities")
            if 'real-time' in feature.lower():
                components.append("- **WebSocket Service**: Real-time communication")
        
        return "\n".join(components)
    
    def _generate_database_schema(self, features: List[str]) -> str:
        return """
```sql
-- Core entities
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add feature-specific tables based on requirements
-- (Detailed schema to be refined during implementation)
```
"""
    
    def _generate_api_schemas(self, features: List[str]) -> str:
        return """
```typescript
// User response schema
interface UserResponse {
    id: number;
    email: string;
    createdAt: string;
    updatedAt: string;
}

// Error response schema
interface ErrorResponse {
    error: string;
    message: string;
    statusCode: number;
}
```
"""
    
    def _generate_backend_services(self, features: List[str]) -> str:
        services = [
            "- **UserService**: User management operations",
            "- **AuthService**: Authentication and authorization",
            "- **ValidationService**: Input validation and sanitization"
        ]
        
        for feature in features:
            service_name = feature.replace(' ', '') + 'Service'
            services.append(f"- **{service_name}**: {feature} related operations")
        
        return "\n".join(services)
    
    def _generate_frontend_components(self, features: List[str]) -> str:
        components = [
            "- **App.vue**: Main application component",
            "- **LoginForm.vue**: User authentication form",
            "- **Dashboard.vue**: Main user interface"
        ]
        
        for feature in features:
            component_name = feature.replace(' ', '') + '.vue'
            components.append(f"- **{component_name}**: {feature} interface component")
        
        return "\n".join(components)
    
    def _generate_integration_points(self, features: List[str]) -> str:
        return """
- **Database Integration**: PostgreSQL with connection pooling
- **Cache Integration**: Redis for session and data caching
- **External APIs**: Third-party service integrations as needed
- **Monitoring Integration**: Application performance monitoring
"""
    
    def _generate_authorization_matrix(self, features: List[str]) -> str:
        return """
| Role  | Read | Create | Update | Delete | Admin |
|-------|------|---------|---------|---------|--------|
| User  | ✓    | ✓      | Own     | Own     | ✗      |
| Admin | ✓    | ✓      | ✓       | ✓       | ✓      |
"""
    
    def _generate_error_handling_spec(self) -> str:
        return """
- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

All errors return structured JSON responses with error codes and messages.
"""
    
    def _generate_testing_strategy(self, complexity: str) -> str:
        strategies = {
            'low': "- Unit tests for core functions\n- Basic integration tests\n- Manual user acceptance testing",
            'medium': "- Comprehensive unit tests (>80% coverage)\n- Integration tests for all APIs\n- Automated E2E tests\n- Performance testing\n- Security testing",
            'high': "- Full test pyramid implementation\n- Automated testing at all levels\n- Load and stress testing\n- Security penetration testing\n- Chaos engineering tests"
        }
        return strategies.get(complexity, strategies['medium'])
    
    def _generate_deployment_requirements(self) -> str:
        return """
- **Containerization**: Docker containers for all services
- **Orchestration**: Kubernetes for deployment and scaling
- **CI/CD Pipeline**: Automated testing and deployment
- **Environment Management**: Separate dev, staging, and production
- **Configuration Management**: Environment-specific configurations
- **Monitoring**: Application and infrastructure monitoring
"""
    
    def _generate_api_endpoints(self, features: List[str]) -> str:
        endpoints = [
            "### Authentication",
            "```http",
            "POST /auth/login",
            "POST /auth/logout", 
            "POST /auth/refresh",
            "```",
            "",
            "### Core Endpoints"
        ]
        
        if not features:
            endpoints.extend([
                "```http",
                "GET /api/data",
                "POST /api/data",
                "PUT /api/data/{id}",
                "DELETE /api/data/{id}",
                "```"
            ])
        else:
            for feature in features:
                feature_slug = feature.lower().replace(' ', '-')
                endpoints.extend([
                    f"```http",
                    f"GET /api/{feature_slug}",
                    f"POST /api/{feature_slug}",
                    f"PUT /api/{feature_slug}/{{id}}",
                    f"DELETE /api/{feature_slug}/{{id}}",
                    f"```",
                    ""
                ])
        
        return "\n".join(endpoints)
    
    def _generate_api_error_responses(self) -> str:
        return """
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input parameters",
  "statusCode": 400,
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  }
}
```
"""
    
    def _generate_story_dependencies(self, features: List[str]) -> str:
        if len(features) <= 1:
            return "- No major dependencies identified"
        
        dependencies = ["- Authentication stories should be completed first"]
        for i, feature in enumerate(features[1:], 2):
            dependencies.append(f"- {feature} stories depend on core functionality")
        
        return "\n".join(dependencies)
    
    def _generate_frontend_architecture(self, features: List[str]) -> str:
        return """
- **Framework**: Vue.js 3 with Composition API
- **State Management**: Pinia for global state
- **Routing**: Vue Router for navigation
- **UI Framework**: Tailwind CSS or Vuetify
- **Build Tool**: Vite for fast development
"""
    
    def _generate_microservices_architecture(self, features: List[str]) -> str:
        services = [
            "- **User Service**: User management and authentication",
            "- **Core Service**: Main business logic"
        ]
        
        for feature in features:
            if len(feature) > 0:
                service_name = feature.title() + " Service"
                services.append(f"- **{service_name}**: {feature} functionality")
        
        return "\n".join(services)
    
    def _generate_data_architecture(self, features: List[str]) -> str:
        return """
- **Primary Database**: PostgreSQL for ACID transactions
- **Cache Layer**: Redis for session and frequently accessed data
- **Search Engine**: Elasticsearch for full-text search (if needed)
- **File Storage**: AWS S3 or equivalent for file uploads
- **Message Queue**: Redis/RabbitMQ for async processing
"""
    
    def _generate_security_architecture(self) -> str:
        return """
- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encryption at rest and in transit
- **API Security**: Rate limiting, input validation, CORS
- **Infrastructure**: VPC, security groups, WAF
"""
    
    def _generate_monitoring_architecture(self) -> str:
        return """
- **Application Monitoring**: New Relic or DataDog
- **Infrastructure Monitoring**: Prometheus + Grafana
- **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Error Tracking**: Sentry for error monitoring
- **Uptime Monitoring**: Pingdom or similar
"""
    
    def _generate_disaster_recovery_plan(self) -> str:
        return """
- **Backup Strategy**: Daily automated backups with point-in-time recovery
- **High Availability**: Multi-AZ deployment with load balancing
- **Failover Process**: Automated failover with manual override
- **Recovery Time Objective (RTO)**: < 4 hours
- **Recovery Point Objective (RPO)**: < 1 hour
"""
    
    def _generate_implementation_recommendations(self, complexity: str) -> str:
        recommendations = {
            'low': [
                "- Start with MVP implementation",
                "- Use proven technology stack",
                "- Focus on core functionality first"
            ],
            'medium': [
                "- Implement in phases with iterative releases",
                "- Use microservices for better scalability",
                "- Implement comprehensive testing strategy"
            ],
            'high': [
                "- Conduct proof-of-concept phase first",
                "- Plan for multiple development teams",
                "- Implement robust monitoring and observability",
                "- Consider using enterprise-grade solutions"
            ]
        }
        return "\n".join(recommendations.get(complexity, recommendations['medium']))
    
    def _generate_clarification_questions(self, user_message: str) -> str:
        questions = [
            "1. What is the expected number of users/traffic volume?",
            "2. Are there any specific technology constraints or preferences?",
            "3. What is the target timeline for implementation?",
            "4. Are there any integration requirements with existing systems?",
            "5. What are the budget constraints for this project?"
        ]
        
        message_lower = user_message.lower()
        if 'mobile' in message_lower:
            questions.append("6. Should this include mobile app development?")
        if 'real-time' in message_lower:
            questions.append("6. What are the real-time requirements and latency expectations?")
        
        return "\n".join(questions)


def main():
    """Main function to process the request"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print(json.dumps({
                "response": "No input provided. Please provide a requirements writing request.",
                "error": "Missing input"
            }))
            return
        
        # Parse JSON input
        try:
            params = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(json.dumps({
                "response": f"Invalid JSON input: {str(e)}",
                "error": "JSON parsing error"
            }))
            return
        
        # Extract user message and metadata
        user_message = params.get('userMessage', '').strip()
        metadata = params.get('metadata', {})
        
        if not user_message:
            print(json.dumps({
                "response": "Please provide a description of the requirements you need me to write.",
                "error": "Empty user message"
            }))
            return
        
        # Process the request
        writer = RequirementsWriter()
        result = writer.process_request(user_message, metadata)
        
        # Output the result
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        # Handle any unexpected errors
        error_response = {
            "response": f"I apologize, but I encountered an error while processing your requirements writing request: {str(e)}",
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_response))


if __name__ == "__main__":
    main() 
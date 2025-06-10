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
- **Frontend**: Vue.js 3 with TypeScript
- **Backend**: NestJS with TypeScript  
- **Database**: PostgreSQL with Redis caching
- **Infrastructure**: Docker + Kubernetes

## 3. Core Components
{self._format_feature_list(features)}

## 4. API Specifications
- RESTful API design
- OpenAPI 3.0 documentation
- JWT authentication
- Rate limiting: 1000 requests/hour

## 5. Database Design
- Normalized relational schema
- Proper indexing for performance
- Migration scripts for deployment

## 6. Security Implementation
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

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

## Core Endpoints
- `GET /api/health` - Health check
- `POST /auth/login` - User authentication
- `GET /api/data` - Retrieve data
- `POST /api/data` - Create new data

## Authentication
```http
POST /auth/login
Content-Type: application/json

{{
  "email": "user@example.com",
  "password": "securepassword"
}}
```

## Error Responses
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_user_story_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate User Stories"""
        features = analysis.get('features', [])
        
        return f"""# User Stories and Acceptance Criteria

## Project Context
Based on: "{user_message}"

## Core User Stories
{self._generate_user_stories(features)}

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Code review completed
- [ ] Documentation updated

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def _generate_architecture_template(self, analysis: Dict[str, Any], user_message: str, metadata: Dict[str, Any]) -> str:
        """Generate Architecture Document"""
        features = analysis.get('features', [])
        
        return f"""# System Architecture Document

## Architecture Overview
System design for: "{user_message}"

## High-Level Architecture
```
Frontend (Vue.js) ↔ API Gateway ↔ Services ↔ Database
```

## Core Services
{self._format_feature_list(features)}

## Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **Database**: PostgreSQL
- **Cache**: Redis
- **Monitoring**: Prometheus + Grafana

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
- **Complexity**: {complexity.title()}
- **Identified Features**: {len(features)}
- **Estimated Effort**: {analysis.get('estimated_effort', 'Unknown')}

## Requirements Breakdown
{self._format_feature_list(features)}

## Implementation Recommendations
- Start with MVP approach
- Use proven technology stack
- Implement iterative development

## Next Steps
1. Detailed technical analysis
2. Resource planning
3. Timeline development
4. Risk assessment

---
*Generated by Requirements Writer Agent on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    # Helper methods
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
    
    def _generate_timeline(self, complexity: str) -> str:
        timelines = {
            'low': "- Sprint 1-2: Core implementation\n- Sprint 3: Testing and refinement",
            'medium': "- Sprint 1-2: Foundation\n- Sprint 3-4: Features\n- Sprint 5: Testing",
            'high': "- Phase 1: Core platform\n- Phase 2: Advanced features\n- Phase 3: Optimization"
        }
        return timelines.get(complexity, timelines['medium'])
    
    def _generate_acceptance_criteria(self, features: List[str]) -> str:
        criteria = [
            "- All functional requirements implemented",
            "- Non-functional requirements met",
            "- Security requirements satisfied",
            "- Performance benchmarks achieved"
        ]
        
        if features:
            for feature in features:
                criteria.append(f"- {feature} functionality works as specified")
        
        return "\n".join(criteria)
    
    def _assess_technical_risks(self, complexity: str) -> str:
        risks = {
            'low': "Minimal technical risks",
            'medium': "Moderate complexity requiring planning",
            'high': "High complexity with integration challenges"
        }
        return risks.get(complexity, risks['medium'])
    
    def _assess_timeline_risks(self, complexity: str) -> str:
        risks = {
            'low': "Low risk of timeline slippage",
            'medium': "Moderate risk requiring management",
            'high': "High risk requiring buffer time"
        }
        return risks.get(complexity, risks['medium'])


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
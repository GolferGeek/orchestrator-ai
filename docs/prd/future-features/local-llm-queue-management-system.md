# Local LLM Queue Management System - Product Requirements Document

## Executive Summary

As our platform defaults to local LLMs (Ollama models like deepseek-r1, qwq, etc.) for improved user experience and privacy, we need a robust queue management system to handle concurrent user requests when local model capacity is exceeded. This system ensures fair resource allocation, excellent user experience, and graceful degradation under load.

## Problem Statement

### Current Situation
- Platform now defaults to local "thinking models" for better content generation
- Local Ollama server has limited concurrent model capacity (3-5 models simultaneously)
- Multiple users submitting requests simultaneously causes resource contention
- No visibility into processing status or wait times
- Failed requests due to resource exhaustion provide poor user experience

### Business Impact
- **User Frustration**: Requests failing or timing out without explanation
- **Resource Waste**: Inefficient utilization of expensive local GPU/CPU resources
- **Scalability Limits**: Cannot handle team/organization-level usage
- **Competitive Disadvantage**: Poor UX compared to external providers

## Solution Overview

Implement a comprehensive queue management system that:
1. **Queues requests** when local models are at capacity
2. **Provides real-time status updates** via WebSocket
3. **Manages model resources** dynamically
4. **Offers fallback options** when appropriate
5. **Maintains enterprise-grade user experience**

## User Stories

### Primary Users: End Users
- **As a user**, I want to know when my request is queued so I understand it's being processed
- **As a user**, I want to see my position in the queue and estimated wait time
- **As a user**, I want real-time updates on my request status
- **As a user**, I want the option to switch to faster external providers if the queue is long
- **As a user**, I want to cancel my queued request if needed

### Secondary Users: Administrators
- **As an admin**, I want to monitor queue health and performance metrics
- **As an admin**, I want to configure queue limits and timeouts
- **As an admin**, I want to prioritize certain users or request types
- **As an admin**, I want alerts when the system is under high load

## Functional Requirements

### 1. Queue Management Core
- **FR-1.1**: Support per-model queues (deepseek-r1, qwq, llama3.2, etc.)
- **FR-1.2**: Implement fair scheduling algorithm (FIFO with optional priority)
- **FR-1.3**: Persistent queue storage (survive server restarts)
- **FR-1.4**: Configurable queue size limits per model
- **FR-1.5**: Request deduplication for identical prompts
- **FR-1.6**: Queue timeout handling with graceful fallback

### 2. Real-Time User Experience
- **FR-2.1**: WebSocket-based real-time status updates
- **FR-2.2**: Queue position tracking ("You are #3 of 7 in queue")
- **FR-2.3**: Estimated processing time calculation
- **FR-2.4**: Processing progress indicators
- **FR-2.5**: Request completion notifications
- **FR-2.6**: Queue cancellation capability
- **FR-2.7**: LLM selector queue status display with real-time updates
- **FR-2.8**: Smart model recommendations based on queue availability

### 3. Model Resource Management
- **FR-3.1**: Dynamic model loading/unloading based on demand
- **FR-3.2**: Memory usage monitoring and limits (MAX_MODEL_MEMORY_GB)
- **FR-3.3**: Model health checking and automatic recovery
- **FR-3.4**: Concurrent model capacity management
- **FR-3.5**: Model warmup optimization for faster processing

### 4. Integration Points
- **FR-4.1**: Integrate with existing CentralizedRoutingService
- **FR-4.2**: Leverage LocalModelStatusService for model availability
- **FR-4.3**: Use existing WebSocket infrastructure
- **FR-4.4**: Integrate with SovereignPolicyService for policy compliance
- **FR-4.5**: Audit logging for all queue operations

### 5. Fallback and Error Handling
- **FR-5.1**: Automatic fallback to external providers after timeout
- **FR-5.2**: User-initiated provider switching during queue wait
- **FR-5.3**: Graceful handling of model crashes/failures
- **FR-5.4**: Request redistribution when models become unavailable
- **FR-5.5**: Emergency queue clearing for system maintenance

## Non-Functional Requirements

### Performance
- **NFR-P.1**: Queue operations must complete within 100ms
- **NFR-P.2**: WebSocket updates must be delivered within 500ms
- **NFR-P.3**: Support up to 100 concurrent queued requests per model
- **NFR-P.4**: System must handle 50 concurrent WebSocket connections

### Reliability
- **NFR-R.1**: 99.9% queue availability (excluding planned maintenance)
- **NFR-R.2**: Zero data loss for queued requests during server restarts
- **NFR-R.3**: Automatic recovery from model failures within 30 seconds
- **NFR-R.4**: Queue state persistence across system reboots

### Scalability
- **NFR-S.1**: Horizontal scaling support for multiple Ollama instances
- **NFR-S.2**: Redis-based queue storage for distributed deployment
- **NFR-S.3**: Support for 10+ concurrent local models
- **NFR-S.4**: Configurable resource limits per organization/user

### Security
- **NFR-SE.1**: Queue data encrypted at rest and in transit
- **NFR-SE.2**: User isolation - users cannot see others' queue positions
- **NFR-SE.3**: Admin-only access to queue management APIs
- **NFR-SE.4**: Audit logging for all queue administrative actions

## Technical Architecture

### Core Components

#### 1. Queue Manager Service
```typescript
interface QueueManagerService {
  enqueue(request: LLMRequest): Promise<QueuedRequest>;
  getQueueStatus(requestId: string): Promise<QueueStatus>;
  cancelRequest(requestId: string): Promise<boolean>;
  processNext(modelId: string): Promise<QueuedRequest | null>;
}
```

#### 2. Model Pool Manager
```typescript
interface ModelPoolManager {
  getAvailableModels(): Promise<ModelInfo[]>;
  reserveModel(modelId: string): Promise<ModelReservation>;
  releaseModel(reservationId: string): Promise<void>;
  loadModel(modelId: string): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
}
```

#### 3. Queue Status WebSocket Gateway
```typescript
interface QueueWebSocketGateway {
  subscribeToUpdates(userId: string, requestId: string): void;
  broadcastQueueUpdate(requestId: string, status: QueueStatus): void;
  notifyCompletion(requestId: string, result: any): void;
}
```

#### 4. Queue Analytics Service
```typescript
interface QueueAnalyticsService {
  getQueueMetrics(): Promise<QueueMetrics>;
  getWaitTimeEstimate(modelId: string): Promise<number>;
  recordProcessingTime(modelId: string, duration: number): void;
}
```

### Data Models

#### QueuedRequest
```typescript
interface QueuedRequest {
  id: string;
  userId: string;
  organizationId?: string;
  modelId: string;
  prompt: string;
  options: any;
  priority: number;
  submittedAt: Date;
  estimatedStartTime?: Date;
  actualStartTime?: Date;
  completedAt?: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  position?: number;
  estimatedWaitTime?: number;
}
```

#### QueueStatus
```typescript
interface QueueStatus {
  requestId: string;
  status: QueueRequestStatus;
  position?: number;
  estimatedWaitTime?: number;
  queueLength: number;
  message: string;
}
```

### Integration Flow

1. **Request Submission**:
   - CentralizedRoutingService determines local model needed
   - Check ModelPoolManager for immediate availability
   - If busy → QueueManagerService.enqueue()
   - Return queue status to user

2. **Queue Processing**:
   - ModelPoolManager notifies when model becomes available
   - QueueManagerService.processNext() gets next request
   - Process request through existing LLM pipeline
   - Notify completion via WebSocket

3. **Real-Time Updates**:
   - Queue position changes → WebSocket update
   - Processing starts → WebSocket update
   - Completion → WebSocket notification + result delivery

## User Experience Design

### Queue Status Messages
- **Initial**: "Your request has been queued for secure local processing"
- **Position**: "You are #3 of 7 in the queue • Estimated wait: 2-3 minutes"
- **Processing**: "Your request is now being processed by the local AI model"
- **Near Completion**: "Processing is 80% complete • Almost ready!"
- **Completed**: "Your response is ready! Processing took 45 seconds."

### Fallback Options
- **Long Queue**: "Queue is longer than usual (8+ requests). Switch to external provider for faster results?"
- **Timeout**: "Local processing is taking longer than expected. Would you like to use an external provider instead?"
- **System Issues**: "Local models are temporarily unavailable. Switching to external provider."

### Visual Indicators
- **Queue Position**: Progress bar showing position in queue
- **Processing**: Animated spinner with processing status
- **Time Estimates**: Dynamic countdown timers
- **Model Info**: Display which local model is being used
- **LLM Selector Queue Status**: Show queue indicators directly in the model selector dropdown

### LLM Selector Enhancements
- **Queue Badges**: Display queue length next to local model names
  - "deepseek-r1 (3 in queue)"
  - "qwq (Queue full - 5+ min wait)"
  - "llama3.2 (Available now)"
- **Visual Cues**: Color-coded indicators for queue status
  - 🟢 Green: Available immediately
  - 🟡 Yellow: Short queue (1-2 requests, <2 min wait)
  - 🟠 Orange: Medium queue (3-5 requests, 2-5 min wait)
  - 🔴 Red: Long queue (5+ requests, >5 min wait)
- **Alternative Suggestions**: Highlight available external models when local queues are long
  - "Consider GPT-4 for faster results" when local queues exceed threshold
- **Real-time Updates**: Queue status in selector updates automatically
- **Smart Defaults**: Automatically suggest least busy local model or external alternatives

## Configuration Options

### Environment Variables
```bash
# Queue Management
QUEUE_MAX_SIZE_PER_MODEL=20
QUEUE_TIMEOUT_MINUTES=5
QUEUE_PRIORITY_ENABLED=false
QUEUE_REDIS_URL=redis://localhost:6379

# Model Pool Management
MODEL_POOL_MAX_CONCURRENT=5
MODEL_POOL_WARMUP_ENABLED=true
MODEL_POOL_AUTO_UNLOAD_MINUTES=10

# WebSocket Configuration
WEBSOCKET_QUEUE_UPDATES_ENABLED=true
WEBSOCKET_HEARTBEAT_INTERVAL=30

# Fallback Behavior
QUEUE_AUTO_FALLBACK_ENABLED=true
QUEUE_FALLBACK_THRESHOLD_MINUTES=3
```

### Admin Configuration UI
- Queue size limits per model
- Priority rules configuration
- Timeout thresholds
- Fallback behavior settings
- Model auto-loading policies

## Success Metrics

### User Experience Metrics
- **Queue Abandonment Rate**: < 10% of users cancel before processing
- **User Satisfaction Score**: > 4.0/5.0 for queued requests
- **Fallback Adoption Rate**: % of users who accept external provider fallback
- **Repeat Usage Rate**: Users continue using local models despite queues

### Technical Metrics
- **Average Queue Wait Time**: < 2 minutes during normal load
- **Queue Processing Throughput**: Requests processed per minute per model
- **Model Utilization Rate**: % of time models are actively processing
- **System Uptime**: > 99.5% availability for queue management

### Business Metrics
- **Local Model Usage Rate**: % of requests processed locally vs externally
- **Resource Efficiency**: Cost per request for local vs external processing
- **Scalability Headroom**: Maximum concurrent users before degradation

## Implementation Phases

### Phase 1: Core Queue Infrastructure (4-6 weeks)
- Basic queue management service
- Redis-based persistence
- Model pool manager integration
- Simple WebSocket status updates

### Phase 2: Enhanced User Experience (3-4 weeks)
- Rich queue status messages
- Time estimation algorithms
- Request cancellation
- Fallback option presentation

### Phase 3: Advanced Features (4-5 weeks)
- Priority queue support
- Dynamic model loading
- Advanced analytics
- Admin management interface

### Phase 4: Optimization & Scaling (3-4 weeks)
- Performance optimization
- Multi-instance support
- Advanced monitoring
- Load testing and tuning

## Risks and Mitigation

### Technical Risks
- **Risk**: Queue system becomes a single point of failure
- **Mitigation**: Redis clustering, fallback to external providers

- **Risk**: WebSocket connections consume too much memory
- **Mitigation**: Connection pooling, automatic cleanup

- **Risk**: Model crashes cause queue backup
- **Mitigation**: Health monitoring, automatic model restart

### User Experience Risks
- **Risk**: Users abandon platform due to wait times
- **Mitigation**: Clear expectations, attractive fallback options

- **Risk**: Queue estimates are inaccurate
- **Mitigation**: Machine learning-based time prediction

### Business Risks
- **Risk**: Increased infrastructure costs
- **Mitigation**: Efficient resource utilization, cost monitoring

## Dependencies

### Internal Dependencies
- CentralizedRoutingService (completed)
- LocalModelStatusService (exists)
- WebSocket infrastructure (exists)
- SovereignPolicyService (completed)

### External Dependencies
- Redis (for queue persistence)
- Ollama API (for model management)
- WebSocket client libraries (frontend)

## Future Enhancements

### Advanced Features
- **Batch Processing**: Group similar requests for efficiency
- **Smart Scheduling**: ML-based optimal queue ordering
- **Multi-Instance Load Balancing**: Distribute across multiple Ollama servers
- **Request Caching**: Cache similar requests to reduce processing

### Enterprise Features
- **SLA Management**: Guaranteed processing times for premium users
- **Resource Quotas**: Per-user/organization limits
- **Advanced Analytics**: Detailed usage and performance reporting
- **Custom Priority Rules**: Business logic-based queue prioritization

## Conclusion

This Local LLM Queue Management System addresses the critical scalability challenge introduced by defaulting to local models. By providing excellent user experience during wait times and graceful fallback options, we maintain the benefits of local processing while ensuring system reliability and user satisfaction.

The phased implementation approach allows for iterative improvement and validation of core concepts before adding advanced features. Success metrics focus on both technical performance and user experience, ensuring the system meets business objectives while providing a foundation for future growth.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-06  
**Author**: AI Assistant  
**Reviewers**: [To be assigned]  
**Status**: Draft - Ready for Review

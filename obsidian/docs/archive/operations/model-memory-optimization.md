# Model Memory Optimization - Operational Runbook

## Overview

This runbook provides procedures for managing Ollama model memory usage in production environments. The system includes intelligent memory management, monitoring, and optimization features.

## Quick Reference

### API Endpoints

- **Memory Stats**: `GET /llm/production/memory/stats`
- **Loaded Models**: `GET /llm/production/memory/models`
- **Load Model**: `POST /llm/production/memory/load/:modelName`
- **Unload Model**: `DELETE /llm/production/memory/unload/:modelName`
- **Optimize Memory**: `POST /llm/production/memory/optimize`
- **System Health**: `GET /llm/production/monitoring/health`
- **Emergency Restart**: `POST /llm/production/operations/emergency-restart`

### Environment Variables

```bash
# Memory Configuration
MAX_MODEL_MEMORY_GB=24              # Maximum memory allocation (default: 24GB)

# Alert Thresholds
ALERT_RESPONSE_TIME_MS=10000        # Alert if response time > 10s
ALERT_ERROR_RATE=0.1                # Alert if error rate > 10%
ALERT_MEMORY_USAGE=0.9              # Alert if memory usage > 90%
ALERT_UNAVAILABLE_TIME_MS=300000    # Alert if model unavailable > 5min
ALERT_CONSECUTIVE_FAILURES=3        # Alert after 3 consecutive failures
```

## Memory Management

### Understanding Memory Pressure

The system categorizes memory pressure into four levels:

1. **Low** (< 60%): Optimal operation, all models can be loaded
2. **Medium** (60-80%): Normal operation, some optimization may occur
3. **High** (80-95%): Active optimization, non-essential models may be unloaded
4. **Critical** (> 95%): Emergency mode, aggressive model unloading

### Three-Tier Model Protection

The system protects three-tier models (ultra-fast, fast, medium) from being unloaded:

- **Ultra-fast tier**: `llama3.2:latest` (2GB)
- **Fast tier**: `qwen3:8b` (4.7GB) 
- **Medium tier**: `gpt-oss:20b` (12GB)

These models are only unloaded if:
- They haven't been used for 30+ minutes
- Memory pressure is critical
- No other models can be unloaded

### Model Size Estimates

```
llama3.2:latest    → 2.0 GB
qwen3:8b          → 4.7 GB
gpt-oss:20b       → 12.0 GB
deepseek-r1:70b   → 40.0 GB
qwq:latest        → 14.0 GB
mistral:latest    → 4.1 GB
codellama:latest  → 3.8 GB
llama2:latest     → 3.8 GB
```

## Operational Procedures

### 1. Daily Health Check

```bash
# Check overall system status
curl -s http://localhost:9000/llm/production/operations/status | jq .

# Check memory stats
curl -s http://localhost:9000/llm/production/memory/stats | jq .

# Check for active alerts
curl -s http://localhost:9000/llm/production/monitoring/alerts | jq .
```

### 2. Memory Optimization

#### Automatic Optimization
The system automatically optimizes memory every minute when pressure is medium or higher.

#### Manual Optimization
```bash
# Trigger immediate optimization
curl -X POST http://localhost:9000/llm/production/memory/optimize

# Check results
curl -s http://localhost:9000/llm/production/memory/stats | jq .
```

### 3. Model Loading/Unloading

#### Load a Specific Model
```bash
# Load with priority and complexity hints
curl -X POST http://localhost:9000/llm/production/memory/load/qwen3:8b \
  -H "Content-Type: application/json" \
  -d '{"taskComplexity": "medium", "priority": "high"}'
```

#### Unload a Model
```bash
# Force unload a specific model
curl -X DELETE http://localhost:9000/llm/production/memory/unload/deepseek-r1:70b
```

#### Preload Three-Tier Models
```bash
# Ensure three-tier models are loaded
curl -X POST http://localhost:9000/llm/production/memory/preload-three-tier
```

### 4. Emergency Procedures

#### Emergency Restart
When the system is in a bad state:

```bash
# Perform emergency restart (clears all models and reloads three-tier)
curl -X POST http://localhost:9000/llm/production/operations/emergency-restart
```

This procedure:
1. Unloads all currently loaded models
2. Refreshes system health status
3. Preloads three-tier models
4. Returns final operational status

#### System Diagnostics
```bash
# Get comprehensive diagnostics
curl -s http://localhost:9000/llm/production/operations/diagnostics | jq .
```

The diagnostics endpoint provides:
- Overall health assessment (healthy/degraded/critical)
- List of identified issues
- Specific recommendations
- Detailed metrics and alerts

## Monitoring and Alerting

### Alert Types

1. **model-unavailable**: Model fails health checks
2. **slow-response**: Response time exceeds threshold
3. **high-error-rate**: Error rate too high
4. **memory-pressure**: Memory usage critical
5. **system-error**: Ollama connection issues

### Alert Severity Levels

- **Critical**: Immediate action required
- **High**: Action needed soon
- **Medium**: Monitor closely
- **Low**: Informational

### Monitoring Endpoints

```bash
# System health overview
curl -s http://localhost:9000/llm/production/monitoring/health | jq .

# Individual model health
curl -s http://localhost:9000/llm/production/monitoring/models | jq .

# Active alerts
curl -s http://localhost:9000/llm/production/monitoring/alerts | jq .

# Alert history (last 50)
curl -s "http://localhost:9000/llm/production/monitoring/alerts/history?limit=50" | jq .
```

## Troubleshooting Guide

### Common Issues

#### 1. High Memory Pressure
**Symptoms**: Memory usage > 90%, slow responses, models failing to load

**Solutions**:
```bash
# Check what's loaded
curl -s http://localhost:9000/llm/production/memory/models | jq .

# Optimize memory
curl -X POST http://localhost:9000/llm/production/memory/optimize

# If critical, unload large models
curl -X DELETE http://localhost:9000/llm/production/memory/unload/deepseek-r1:70b
```

#### 2. Models Not Responding
**Symptoms**: Health checks failing, timeout errors

**Solutions**:
```bash
# Force health check
curl -X POST http://localhost:9000/llm/production/monitoring/health-check

# Check Ollama status directly
ollama list
ollama ps

# Restart problematic model
curl -X DELETE http://localhost:9000/llm/production/memory/unload/problematic-model
curl -X POST http://localhost:9000/llm/production/memory/load/problematic-model
```

#### 3. Ollama Connection Issues
**Symptoms**: "Ollama service is not connected" alerts

**Solutions**:
```bash
# Check if Ollama is running
ps aux | grep ollama

# Check Ollama API
curl http://localhost:11434/api/version

# Restart Ollama if needed
pkill ollama
ollama serve &

# Emergency restart our system
curl -X POST http://localhost:9000/llm/production/operations/emergency-restart
```

#### 4. Slow Response Times
**Symptoms**: Average response time > 10 seconds

**Solutions**:
```bash
# Check system resources
top
free -h

# Check memory pressure
curl -s http://localhost:9000/llm/production/memory/stats | jq .memoryPressure

# Optimize if needed
curl -X POST http://localhost:9000/llm/production/memory/optimize

# Consider reducing loaded models
curl -s http://localhost:9000/llm/production/memory/models | jq '.models[] | select(.useCount < 5)'
```

### Performance Tuning

#### Memory Configuration
Adjust based on available system RAM:

```bash
# For 16GB systems
export MAX_MODEL_MEMORY_GB=12

# For 32GB systems  
export MAX_MODEL_MEMORY_GB=24

# For 64GB systems
export MAX_MODEL_MEMORY_GB=48

# For 96GB+ systems
export MAX_MODEL_MEMORY_GB=72
```

#### Alert Thresholds
Tune based on your performance requirements:

```bash
# More sensitive (faster alerts)
export ALERT_RESPONSE_TIME_MS=5000
export ALERT_ERROR_RATE=0.05
export ALERT_CONSECUTIVE_FAILURES=2

# Less sensitive (fewer alerts)
export ALERT_RESPONSE_TIME_MS=15000
export ALERT_ERROR_RATE=0.15
export ALERT_CONSECUTIVE_FAILURES=5
```

## Maintenance Tasks

### Weekly Tasks
1. Review alert history for patterns
2. Check average response times
3. Verify three-tier models are healthy
4. Update model size estimates if needed

### Monthly Tasks
1. Review and tune alert thresholds
2. Analyze memory usage patterns
3. Update documentation with new models
4. Test emergency procedures

### Commands for Maintenance
```bash
# Weekly health report
curl -s http://localhost:9000/llm/production/operations/diagnostics | jq '{overallHealth, issues, recommendations, memoryStats: .memoryStats | {memoryPressure, loadedModels, threeTierModels}}'

# Monthly alert analysis
curl -s "http://localhost:9000/llm/production/monitoring/alerts/history?limit=1000" | jq 'group_by(.type) | map({type: .[0].type, count: length}) | sort_by(.count) | reverse'

# Clear old alert history (monthly)
curl -X DELETE http://localhost:9000/llm/production/monitoring/alerts/history
```

## Integration with Existing Systems

### Prometheus Metrics (Future)
The system is designed to integrate with Prometheus for metrics collection:

- Memory usage metrics
- Model health metrics  
- Response time histograms
- Alert counters

### Log Aggregation
Monitor these log patterns:

- `Memory optimization freed` - Memory optimization events
- `CRITICAL ALERT` - Critical system alerts
- `Emergency restart` - Emergency procedures
- `Model.*loaded successfully` - Model loading events

### Backup and Recovery
The system is stateless except for:
- Alert history (stored in database if available)
- Model loading preferences (stored in database)
- Configuration (environment variables)

No special backup procedures are required beyond standard database backups.

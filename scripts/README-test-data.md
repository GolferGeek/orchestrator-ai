# Test Data and Database Seeding

This directory contains scripts and migrations for seeding the database with test data for the LLM evaluation system.

## Overview

The test data infrastructure provides:

1. **Comprehensive seed data** for providers, models, and CIDAFM commands
2. **Realistic test scenarios** with different user types and usage patterns  
3. **Performance testing data** for load testing and optimization
4. **Analytics test data** for dashboard and reporting validation
5. **Easy reset and reload utilities** for development

## Files

### Migration Files (in `/_supabase/migrations/`)

- `20250630120002_seed_providers_and_models.sql` - Core provider and model data
- `20250630120003_seed_cidafm_commands.sql` - Built-in CIDAFM commands
- `20250701100000_seed_test_data.sql` - Comprehensive test data with realistic usage patterns

### Utility Scripts (in `/scripts/`)

- `reset-test-data.sql` - Clean slate: removes all test data
- `load-test-scenarios.sql` - Load specific test scenarios
- `README-test-data.md` - This documentation

## Seeded Data

### 1. Providers & Models

**5 Providers:**
- OpenAI (GPT-4o, GPT-4o-mini, o1-preview, o1-mini)
- Anthropic (Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus)
- Google (Gemini 1.5 Pro, Gemini 1.5 Flash)
- Cohere (Command R+, Command R)
- Mistral (Mistral Large, Mistral Medium)

**Includes current pricing, capabilities, strengths/weaknesses, and use cases**

### 2. CIDAFM Commands

**Built-in Commands:**
- **Execution (!)**: import-cid, export-context, state-check, step-by-step, cost-estimate, model-info, usage-stats
- **Response (^)**: cidafm-optimize, fad, concise, detailed, creative, code-focused, beginner-friendly, bullet-points, with-examples  
- **State (&)**: token-efficient, context-independent, disciplined, friendly, professional, technical, educational, cost-conscious, security-focused, multilingual, accessible

### 3. Test Users & Usage Patterns

**Three User Types:**

1. **Business User** (`user-1`)
   - Heavy GPT-4o usage
   - Professional tone preferences
   - Moderate cost tolerance
   - 15+ messages with business scenarios

2. **Cost-Conscious Developer** (`user-2`) 
   - Prefers cheaper models (Gemini Flash, GPT-4o-mini)
   - Friendly, beginner-friendly modifiers
   - High volume, low cost per query
   - 15+ messages with development tasks

3. **Researcher** (`user-3`)
   - Uses high-end models (Claude 3.5 Sonnet, GPT-4o)
   - Technical, detailed responses
   - Complex queries, willing to pay for quality
   - 15+ messages with research scenarios

### 4. Performance Metrics

- **30 days** of synthetic performance data
- **4 models** tracked with realistic metrics
- Includes response times, costs, ratings, and usage volumes
- Enables testing of analytics dashboards

## Usage

### Initial Setup

1. **Run migrations** (if not already applied):
```bash
supabase db reset
# Or apply specific migrations:
supabase db migrate up
```

2. **Verify seed data**:
```sql
-- Check providers and models
SELECT p.name, COUNT(m.id) as model_count 
FROM providers p 
LEFT JOIN models m ON p.id = m.provider_id 
GROUP BY p.name;

-- Check CIDAFM commands by type
SELECT type, COUNT(*) FROM cidafm_commands GROUP BY type;
```

### Development Workflow

#### Load Test Data
```bash
# Option 1: Re-run migration (full reset)
supabase db reset

# Option 2: Load development scenario
psql -d your_db -f scripts/load-test-scenarios.sql
```

#### Reset Test Data
```bash
# Remove all test data, keep schema
psql -d your_db -f scripts/reset-test-data.sql
```

#### Load Specific Scenarios
```sql
-- Edit the scenario variable in load-test-scenarios.sql
\set scenario 'minimal'      -- Basic smoke testing
\set scenario 'development'  -- Rich feature development data  
\set scenario 'performance'  -- 10,000 messages for load testing
\set scenario 'analytics'    -- Diverse patterns for analytics

\i scripts/load-test-scenarios.sql
```

### Testing Different Scenarios

#### Minimal Testing
```sql
-- Load minimal data for quick smoke tests
\set scenario 'minimal'
\i scripts/load-test-scenarios.sql
-- Result: 1 user, 1 message
```

#### Feature Development
```sql
-- Load rich development data
\set scenario 'development'  
\i scripts/load-test-scenarios.sql
-- Result: 3 user types, ~50 messages, realistic patterns
```

#### Performance Testing
```sql
-- Load high-volume data
\set scenario 'performance'
\i scripts/load-test-scenarios.sql
-- Result: 10 users, 10,000 messages
```

#### Analytics Testing
```sql
-- Load diverse analytics patterns
\set scenario 'analytics'
\i scripts/load-test-scenarios.sql
-- Result: 3 user patterns, 280 messages with specific analytics features
```

## Test Data Characteristics

### Realistic Pricing
- Uses current API pricing (as of Dec 2024)
- Reflects real cost differences between models
- Enables accurate cost estimation testing

### Temporal Distribution
- Messages span last 30 days
- Different frequency patterns per user type
- Enables time-series analytics testing

### CIDAFM Usage Patterns
- Each user type has characteristic command preferences
- Includes both built-in and custom commands
- Tests command processing and analytics

### Model Performance Variation
- Different response times by model type
- Realistic cost/quality trade-offs
- Rating patterns that reflect model capabilities

## API Testing Helpers

### Quick Validation Queries

```sql
-- User usage summary
SELECT * FROM test_user_summaries;

-- Model popularity ranking  
SELECT * FROM test_model_popularity;

-- Recent CIDAFM usage
SELECT 
    m.user_message,
    array_agg(c.command_type || c.command_name) as commands_used
FROM messages m
JOIN message_cidafm_usage c ON m.id = c.message_id  
WHERE m.timestamp > NOW() - INTERVAL '7 days'
GROUP BY m.id, m.user_message
LIMIT 10;

-- Cost analysis by user type
SELECT 
    CASE 
        WHEN user_id LIKE '%111111%' THEN 'Business User'
        WHEN user_id LIKE '%222222%' THEN 'Cost-Conscious Dev'  
        WHEN user_id LIKE '%333333%' THEN 'Researcher'
        ELSE 'Other'
    END as user_type,
    COUNT(*) as messages,
    SUM(total_cost) as total_spent,
    AVG(total_cost) as avg_cost_per_message
FROM messages 
GROUP BY user_type
ORDER BY total_spent DESC;
```

### API Endpoint Testing

```bash
# Test with realistic user IDs
export TEST_USER_1="11111111-aaaa-bbbb-cccc-111111111111"
export TEST_USER_2="22222222-aaaa-bbbb-cccc-222222222222"  
export TEST_USER_3="33333333-aaaa-bbbb-cccc-333333333333"

# Test usage stats endpoint
curl -X GET "http://localhost:3001/api/usage/stats" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "X-User-ID: $TEST_USER_1"

# Test model performance
curl -X GET "http://localhost:3001/api/usage/model-performance" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Test CIDAFM processing  
curl -X POST "http://localhost:3001/api/cidafm/process" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "^concise &friendly Explain machine learning",
    "activeCommands": ["concise", "friendly"]
  }'
```

## Troubleshooting

### Common Issues

1. **Foreign Key Errors**
   - Ensure providers/models are seeded before test data
   - Check that UUIDs in test data match seeded providers

2. **Permission Errors**
   - Verify RLS policies allow test user access
   - Check that service role has necessary permissions

3. **Data Conflicts**
   - Reset with `reset-test-data.sql` before loading new scenarios
   - Use `TRUNCATE CASCADE` for complete reset if needed

### Data Validation

```sql
-- Check data integrity
SELECT 
    'Messages' as table_name, COUNT(*) as count FROM messages
UNION ALL  
SELECT 'Providers', COUNT(*) FROM providers
UNION ALL
SELECT 'Models', COUNT(*) FROM models  
UNION ALL
SELECT 'CIDAFM Commands', COUNT(*) FROM cidafm_commands
UNION ALL
SELECT 'Performance Metrics', COUNT(*) FROM model_performance_metrics;

-- Check for orphaned records
SELECT 'Orphaned messages' as issue, COUNT(*)
FROM messages m 
LEFT JOIN models mod ON m.model_id = mod.id
WHERE mod.id IS NULL;
```

### Performance Monitoring

```sql
-- Query performance on large datasets
EXPLAIN ANALYZE SELECT 
    user_id, 
    COUNT(*), 
    SUM(total_cost)
FROM messages 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_id;

-- Index usage verification
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Best Practices

1. **Development Cycle**
   - Use `minimal` for quick feature tests
   - Use `development` for comprehensive testing
   - Use `performance` before production deployment

2. **CI/CD Integration**
   - Reset test data before each test run
   - Use consistent test scenarios across environments
   - Validate data integrity after seeding

3. **Data Privacy**
   - All test data uses synthetic/dummy values
   - No real user data or API keys
   - Safe for development and staging environments

4. **Performance Considerations**
   - Performance scenario generates 10K records
   - Monitor database size in development
   - Consider cleanup after performance testing

## Contributing

When adding new test data:

1. **Follow naming conventions**: Use descriptive user IDs and realistic data
2. **Update this README**: Document new scenarios and data patterns  
3. **Test data integrity**: Verify foreign key relationships
4. **Consider performance**: Large datasets should be optional scenarios
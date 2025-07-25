/**
 * Test Data Fixtures for Supabase MCP Testing
 * 
 * Provides standardized test data for consistent testing across all MCP tools.
 * Uses existing database schema without creating separate test tables.
 */

export interface TestPromptCase {
  id: string;
  description: string;
  prompt: string;
  expectedSQL?: string;
  expectedTables: string[];
  expectedFeatures: string[];
  complexity: 'easy' | 'mid' | 'advanced';
  category: string;
}

export const TEST_PROMPTS: TestPromptCase[] = [
  // ================== EASY LEVEL TESTS ==================
  {
    id: 'easy-001',
    description: 'Simple SELECT all users',
    prompt: 'Get all users',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT'],
    complexity: 'easy',
    category: 'basic-select'
  },
  {
    id: 'easy-002', 
    description: 'Users created today',
    prompt: 'Find users created today',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT', 'WHERE', 'DATE'],
    complexity: 'easy',
    category: 'date-filtering'
  },
  {
    id: 'easy-003',
    description: 'Active agent conversations',
    prompt: 'Show active agent conversations',
    expectedTables: ['agent_conversations'],
    expectedFeatures: ['SELECT', 'WHERE'],
    complexity: 'easy',
    category: 'basic-filtering'
  },
  {
    id: 'easy-004',
    description: 'Count total users',
    prompt: 'Count total users',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT', 'COUNT'],
    complexity: 'easy',
    category: 'aggregation'
  },
  {
    id: 'easy-005',
    description: 'Find user by email',
    prompt: 'Get user by email test@example.com',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT', 'WHERE'],
    complexity: 'easy',
    category: 'specific-lookup'
  },
  {
    id: 'easy-006',
    description: 'List agent types',
    prompt: 'List all agent types',
    expectedTables: ['agent_conversations'],
    expectedFeatures: ['SELECT', 'DISTINCT'],
    complexity: 'easy',
    category: 'distinct-values'
  },
  {
    id: 'easy-007',
    description: 'Gmail users',
    prompt: 'Find users with Gmail addresses',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT', 'WHERE', 'LIKE'],
    complexity: 'easy',
    category: 'pattern-matching'
  },
  {
    id: 'easy-008',
    description: 'Recent conversations',
    prompt: 'Show recent conversations',
    expectedTables: ['agent_conversations'],
    expectedFeatures: ['SELECT', 'WHERE', 'ORDER BY'],
    complexity: 'easy',
    category: 'recent-data'
  },
  {
    id: 'easy-009',
    description: 'Conversations this week',
    prompt: 'Get agent conversations created this week',
    expectedTables: ['agent_conversations'],
    expectedFeatures: ['SELECT', 'WHERE', 'DATE_TRUNC'],
    complexity: 'easy',
    category: 'date-filtering'
  },
  {
    id: 'easy-010',
    description: 'Count active conversations',
    prompt: 'Count active conversations',
    expectedTables: ['agent_conversations'],
    expectedFeatures: ['SELECT', 'COUNT', 'WHERE'],
    complexity: 'easy',
    category: 'conditional-count'
  },

  // ================== MID LEVEL TESTS ==================
  {
    id: 'mid-001',
    description: 'Users with conversation counts',
    prompt: 'Show users with their conversation counts',
    expectedTables: ['users', 'agent_conversations'],
    expectedFeatures: ['SELECT', 'LEFT JOIN', 'COUNT', 'GROUP BY'],
    complexity: 'mid',
    category: 'join-aggregation'
  },
  {
    id: 'mid-002',
    description: 'Conversations with user details in date range',
    prompt: 'Find conversations between 2024-01-01 and 2024-12-31 with user details',
    expectedTables: ['agent_conversations', 'users'],
    expectedFeatures: ['SELECT', 'JOIN', 'WHERE', 'BETWEEN'],
    complexity: 'mid',
    category: 'join-filtering'
  },
  {
    id: 'mid-003',
    description: 'Average execution time by tool',
    prompt: 'Get average execution time by MCP tool',
    expectedTables: ['mcp_executions'],
    expectedFeatures: ['SELECT', 'AVG', 'GROUP BY'],
    complexity: 'mid',
    category: 'aggregation-grouping'
  },
  {
    id: 'mid-004',
    description: 'Users without conversations',
    prompt: 'Show users who have never had conversations',
    expectedTables: ['users', 'agent_conversations'],
    expectedFeatures: ['SELECT', 'LEFT JOIN', 'WHERE', 'IS NULL'],
    complexity: 'mid',
    category: 'anti-join'
  },
  {
    id: 'mid-005',
    description: 'Conversations with many tasks',
    prompt: 'Find agent conversations with more than 10 tasks',
    expectedTables: ['agent_conversations', 'tasks'],
    expectedFeatures: ['SELECT', 'JOIN', 'GROUP BY', 'HAVING', 'COUNT'],
    complexity: 'mid',
    category: 'having-clause'
  },
  {
    id: 'mid-006',
    description: 'Monthly user trends',
    prompt: 'Get monthly user registration trends',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT', 'DATE_TRUNC', 'COUNT', 'GROUP BY', 'ORDER BY'],
    complexity: 'mid',
    category: 'time-series'
  },
  {
    id: 'mid-007',
    description: 'Top active users',
    prompt: 'Show top 5 most active users by conversation count',
    expectedTables: ['users', 'agent_conversations'],
    expectedFeatures: ['SELECT', 'JOIN', 'COUNT', 'GROUP BY', 'ORDER BY', 'LIMIT'],
    complexity: 'mid',
    category: 'ranking'
  },
  {
    id: 'mid-008',
    description: 'Users with conversations but no tasks',
    prompt: 'Find users with conversations but no completed tasks',
    expectedTables: ['users', 'agent_conversations', 'tasks'],
    expectedFeatures: ['SELECT', 'JOIN', 'LEFT JOIN', 'WHERE', 'IS NULL'],
    complexity: 'mid',
    category: 'complex-filtering'
  },
  {
    id: 'mid-009',
    description: 'Agent success rates by type',
    prompt: 'Get conversations grouped by agent type with task success rates',
    expectedTables: ['agent_conversations', 'tasks'],
    expectedFeatures: ['SELECT', 'JOIN', 'GROUP BY', 'COUNT', 'CASE'],
    complexity: 'mid',
    category: 'conditional-aggregation'
  },
  {
    id: 'mid-010',
    description: 'Daily MCP usage stats',
    prompt: 'Show daily MCP usage statistics',
    expectedTables: ['mcp_executions'],
    expectedFeatures: ['SELECT', 'DATE_TRUNC', 'COUNT', 'GROUP BY', 'ORDER BY'],
    complexity: 'mid',
    category: 'daily-analytics'
  },

  // ================== ADVANCED LEVEL TESTS ==================
  {
    id: 'adv-001',
    description: 'Running totals with percentage change',
    prompt: 'Show running total of user registrations by month with percentage change',
    expectedTables: ['users'],
    expectedFeatures: ['SELECT', 'DATE_TRUNC', 'COUNT', 'SUM', 'OVER', 'LAG', 'WINDOW'],
    complexity: 'advanced',
    category: 'window-functions'
  },
  {
    id: 'adv-002',
    description: 'Similar user patterns',
    prompt: 'Find users whose conversation patterns are similar using window functions',
    expectedTables: ['users', 'agent_conversations'],
    expectedFeatures: ['SELECT', 'WINDOW', 'PARTITION BY', 'ROW_NUMBER', 'RANK'],
    complexity: 'advanced',
    category: 'pattern-analysis'
  },
  {
    id: 'adv-003',
    description: 'Cohort retention analysis',
    prompt: 'Get complex cohort analysis of user retention by agent type',
    expectedTables: ['users', 'agent_conversations'],
    expectedFeatures: ['WITH', 'CTE', 'WINDOW', 'DATE_TRUNC', 'LAG', 'CASE'],
    complexity: 'advanced',
    category: 'cohort-analysis'
  },
  {
    id: 'adv-004',
    description: 'Execution time percentiles',
    prompt: 'Show agent conversations with execution time percentiles and outlier detection',
    expectedTables: ['agent_conversations', 'mcp_executions'],
    expectedFeatures: ['SELECT', 'PERCENTILE_CONT', 'WINDOW', 'CASE', 'STDDEV'],
    complexity: 'advanced',
    category: 'statistical-analysis'
  },
  {
    id: 'adv-005',
    description: 'Recursive conversation threads',
    prompt: 'Find conversation threads with recursive task relationships',
    expectedTables: ['agent_conversations', 'tasks'],
    expectedFeatures: ['WITH RECURSIVE', 'CTE', 'JOIN', 'UNION'],
    complexity: 'advanced',
    category: 'recursive-queries'
  },
  {
    id: 'adv-006',
    description: 'Time-series adoption analysis',
    prompt: 'Generate time-series analysis of MCP tool adoption rates',
    expectedTables: ['mcp_executions'],
    expectedFeatures: ['WITH', 'WINDOW', 'LAG', 'LEAD', 'OVER', 'DATE_TRUNC'],
    complexity: 'advanced',
    category: 'time-series-analysis'
  },
  {
    id: 'adv-007',
    description: 'Advanced user segmentation',
    prompt: 'Show advanced user segmentation based on usage patterns',
    expectedTables: ['users', 'agent_conversations', 'mcp_executions'],
    expectedFeatures: ['WITH', 'CTE', 'NTILE', 'CASE', 'WINDOW'],
    complexity: 'advanced',
    category: 'segmentation'
  },
  {
    id: 'adv-008',
    description: 'Anomaly detection',
    prompt: 'Find anomalous execution patterns using statistical functions',
    expectedTables: ['mcp_executions'],
    expectedFeatures: ['SELECT', 'STDDEV', 'AVG', 'ABS', 'CASE', 'WINDOW'],
    complexity: 'advanced',
    category: 'anomaly-detection'
  },
  {
    id: 'adv-009',
    description: 'Performance metrics pivot',
    prompt: 'Generate pivot table of agent performance metrics',
    expectedTables: ['agent_conversations', 'tasks', 'mcp_executions'],
    expectedFeatures: ['WITH', 'CTE', 'CASE', 'SUM', 'GROUP BY'],
    complexity: 'advanced',
    category: 'pivot-analysis'
  },
  {
    id: 'adv-010',
    description: 'Complex funnel analysis',
    prompt: 'Show complex funnel analysis from registration to conversation completion',
    expectedTables: ['users', 'agent_conversations', 'tasks'],
    expectedFeatures: ['WITH', 'CTE', 'WINDOW', 'LAG', 'COUNT', 'CASE'],
    complexity: 'advanced',
    category: 'funnel-analysis'
  }
];

export const CONTEXT_EXAMPLES = {
  successful_patterns: `
## Successful Query Patterns
### User Analytics Queries
- For "active users", check if conversations exist: \`WHERE EXISTS (SELECT 1 FROM agent_conversations WHERE user_id = users.id)\`
- For "recent", use: \`WHERE created_at >= NOW() - INTERVAL '7 days'\`
- For "this week", use: \`WHERE created_at >= DATE_TRUNC('week', NOW())\`

### Agent Conversation Queries
- Always join with users for user details: \`LEFT JOIN users ON agent_conversations.user_id = users.id\`
- For active conversations: \`WHERE ended_at IS NULL\`
- For conversation counts: \`COUNT(agent_conversations.id)\`
`,

  error_patterns: `
## Common Error Patterns & Fixes
### Column Name Issues
**Error**: Using "created_date" or "updated_date"
**Fix**: Always use "created_at" and "updated_at"

**Error**: Using "agent_id" in conversations table  
**Fix**: The table structure doesn't have agent_id, use agent_name and agent_type

### Join Pattern Issues
**Error**: Direct joins without considering nullable relationships
**Fix**: Use LEFT JOINs for nullable foreign keys like agent_conversation_id and session_id
`,

  advanced_patterns: `
## Advanced SQL Patterns
### Window Functions
- For ranking: \`ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC)\`
- For running totals: \`SUM(count) OVER (ORDER BY date_column ROWS UNBOUNDED PRECEDING)\`

### Common Table Expressions (CTEs)
- Use for complex multi-step queries
- Helpful for user cohort analysis and funnel metrics
- Example: \`WITH user_stats AS (SELECT user_id, COUNT(*) as conversation_count FROM agent_conversations GROUP BY user_id)\`
`
};

export const EXPECTED_SQL_EXAMPLES = {
  'easy-001': 'SELECT * FROM users;',
  'easy-002': "SELECT * FROM users WHERE created_at >= CURRENT_DATE;",
  'easy-003': "SELECT * FROM agent_conversations WHERE ended_at IS NULL;",
  'easy-004': "SELECT COUNT(*) FROM users;",
  'easy-005': "SELECT * FROM users WHERE email = 'test@example.com';",
  'mid-001': `
    SELECT u.*, COUNT(ac.id) as conversation_count 
    FROM users u 
    LEFT JOIN agent_conversations ac ON u.id = ac.user_id 
    GROUP BY u.id;
  `,
  'adv-001': `
    WITH monthly_registrations AS (
      SELECT DATE_TRUNC('month', created_at) as month,
             COUNT(*) as registrations
      FROM users 
      GROUP BY DATE_TRUNC('month', created_at)
    )
    SELECT month,
           registrations,
           SUM(registrations) OVER (ORDER BY month) as running_total,
           LAG(registrations) OVER (ORDER BY month) as prev_month,
           CASE 
             WHEN LAG(registrations) OVER (ORDER BY month) IS NOT NULL 
             THEN ((registrations - LAG(registrations) OVER (ORDER BY month)) * 100.0 / LAG(registrations) OVER (ORDER BY month))
             ELSE NULL 
           END as percentage_change
    FROM monthly_registrations
    ORDER BY month;
  `
};

// Test data for bulk testing scenarios
export const BULK_TEST_SCENARIOS = {
  performance_testing: {
    user_count: 100,
    conversations_per_user: 5,
    executions_per_conversation: 10,
    failure_rate: 0.1 // 10% failure rate
  },
  
  context_learning: {
    patterns_to_learn: [
      'Users with recent activity should use last_active_at',
      'Conversation metrics should group by agent_type',
      'MCP analytics should include execution_time_ms averages'
    ],
    error_patterns_to_avoid: [
      'Using created_date instead of created_at',
      'Missing JOIN conditions',
      'Incorrect table aliases'
    ]
  }
};
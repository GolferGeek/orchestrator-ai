# Phase 6: Orchestration Examples - PRD

## Overview

**Goal**: Build real-world orchestration examples that demonstrate the power of multi-agent workflows, starting with a Finance Manager that uses tool agents to create comprehensive financial analysis.

**Success Criteria**:
- Finance Manager orchestrator fully functional
- Demonstrates Plans → Build workflow with orchestration mode
- Uses Supabase tool agent for metrics retrieval
- Generates professional financial reports with visualizations
- Serves as reference implementation for future orchestrations
- Documentation and templates for building similar orchestrators

## Phase Dependencies

**Depends On**:
- ✅ Phase 0: Aggressive Cleanup
- ✅ Phase 1: Context Agents (conversation infrastructure, mode-based routing)
- ✅ Phase 4: Tool Agents (Supabase MCP agent)
- ✅ Phase 5: Agent Builder (UI for creating orchestrators)

**Enables**:
- Phase 7: Enhanced Orchestration (complex multi-agent workflows)
- Real-world use cases for agent platform
- Template library for Agent Builder

## Background

Orchestration agents coordinate multiple specialized agents to complete complex tasks. The Finance Manager is the perfect first example because it:

1. **Multi-Agent Coordination**: Combines data retrieval (Supabase) + visualization (chart generation) + reporting (document generation)
2. **Real Business Value**: Solves actual financial analysis needs
3. **Demonstrates Full Workflow**: Plan mode (define analysis) → Build mode (execute and report)
4. **Reusable Pattern**: Template for other orchestrations (Marketing Manager, Operations Dashboard, etc.)

## Finance Manager Architecture

### High-Level Flow

```
User Request
    ↓
Finance Manager Orchestrator (mode: 'orchestrate')
    ↓
┌───────────────────────────────────────────────────┐
│ Step 1: Planning Phase (mode: 'plan')             │
│ - Understand financial analysis requirements      │
│ - Define metrics to retrieve                      │
│ - Specify report structure                        │
│ - Save as Plan                                    │
└───────────────────────────────────────────────────┘
    ↓
User Reviews Plan → Refines → Approves
    ↓
┌───────────────────────────────────────────────────┐
│ Step 2: Execution Phase (mode: 'build')           │
│                                                   │
│  2a. Supabase Agent (mode: 'tool')                │
│      - Execute SQL queries for metrics            │
│      - Return structured data                     │
│                                                   │
│  2b. Chart Generator Agent (mode: 'tool')         │
│      - Create visualizations from data            │
│      - Generate chart images/SVG                  │
│                                                   │
│  2c. Report Compiler (mode: 'build')              │
│      - Combine metrics + charts                   │
│      - Generate markdown report                   │
│      - Save as Deliverable                        │
└───────────────────────────────────────────────────┘
    ↓
Financial Report Deliverable
```

### Mode-Based Orchestration

```typescript
// User initiates finance analysis
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'orchestrate',
  agentSlug: 'finance-manager',
  message: 'Create Q1 2025 revenue analysis comparing to Q4 2024'
}

// Finance Manager orchestrator logic:
async executeOrchestration(context) {
  // 1. PLANNING PHASE
  const planTask = await this.tasksService.executeTask({
    conversationId: context.conversationId,
    mode: 'plan',
    message: context.message,
    agentSlug: 'finance-manager'
  });

  // Plan saved to plans table, user can review/refine
  // When user approves: "Build this plan"

  // 2. EXECUTION PHASE (triggered by user approval)
  const currentPlan = await this.plansService.getCurrentPlan(context.conversationId);

  // 2a. Retrieve metrics using Supabase agent
  const metricsTask = await this.tasksService.executeTask({
    conversationId: context.conversationId,
    mode: 'tool',
    toolAgent: 'supabase-query',
    input: {
      query: {
        table: 'financial_transactions',
        filters: {
          date_range: { gte: '2025-01-01', lte: '2025-03-31' }
        },
        aggregates: {
          total_revenue: { sum: 'amount' },
          avg_transaction: { avg: 'amount' }
        },
        groupBy: ['month']
      }
    }
  });

  // 2b. Generate charts
  const chartTask = await this.tasksService.executeTask({
    conversationId: context.conversationId,
    mode: 'tool',
    toolAgent: 'chart-generator',
    input: {
      type: 'line',
      data: metricsTask.output.data,
      title: 'Q1 2025 Revenue Trend'
    }
  });

  // 2c. Compile report
  const reportTask = await this.tasksService.executeTask({
    conversationId: context.conversationId,
    mode: 'build',
    agentSlug: 'report-compiler',
    context: {
      plan: currentPlan,
      metrics: metricsTask.output,
      charts: chartTask.output
    }
  });

  // Deliverable saved to deliverables table
  return reportTask;
}
```

## Finance Manager Agent Configuration

### Agent Definition

```typescript
export const FINANCE_MANAGER_AGENT: AgentConfig = {
  // Identity
  id: 'finance-manager-v1',
  name: 'finance-manager',
  namespace: 'system',
  displayName: 'Finance Manager',
  description: 'Orchestrates comprehensive financial analysis with metrics, visualizations, and reporting',
  icon: '📊',
  tags: ['finance', 'orchestration', 'analytics', 'reporting'],

  // Type & Behavior
  type: 'orchestration',
  mode: 'orchestrate',

  // LLM Configuration
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.3, // Lower temperature for consistent financial analysis
    maxTokens: 16000,
    systemPrompt: `You are a Finance Manager orchestrator agent.

Your role is to coordinate financial analysis by:
1. Understanding the user's financial analysis requirements
2. Planning the analysis structure (metrics, timeframes, comparisons)
3. Orchestrating sub-agents to retrieve data and create visualizations
4. Compiling comprehensive financial reports

When in PLANNING mode:
- Ask clarifying questions about timeframes, metrics, and comparisons
- Define clear analysis structure
- Specify which metrics to retrieve and how to visualize them

When in EXECUTION mode:
- Coordinate Supabase agent for data retrieval
- Use Chart Generator for visualizations
- Compile final report with insights and recommendations

Always maintain financial accuracy and provide actionable insights.`,
  },

  // Orchestration Configuration
  orchestrationConfig: {
    workflow: {
      steps: [
        {
          id: 'retrieve_metrics',
          agent: 'supabase-query',
          mode: 'tool',
          description: 'Retrieve financial metrics from database',
          inputMapping: {
            query: 'context.metricsQuery'
          }
        },
        {
          id: 'generate_charts',
          agent: 'chart-generator',
          mode: 'tool',
          description: 'Create visualizations from metrics',
          inputMapping: {
            data: 'steps.retrieve_metrics.output.data',
            chartConfig: 'context.chartConfig'
          }
        },
        {
          id: 'compile_report',
          agent: 'report-compiler',
          mode: 'build',
          description: 'Generate final financial report',
          inputMapping: {
            plan: 'context.currentPlan',
            metrics: 'steps.retrieve_metrics.output',
            charts: 'steps.generate_charts.output'
          }
        }
      ],
      errorHandling: 'retry',
      parallelExecution: false // Sequential execution for clarity
    },
    subAgents: ['supabase-query', 'chart-generator', 'report-compiler']
  },

  // Deliverable Configuration
  deliverableConfig: {
    generateDeliverable: true,
    deliverableType: 'financial_report',
    format: 'markdown',
    template: 'financial-report-template'
  },

  // Version & Status
  version: '1.0.0',
  status: 'published',
  environment: 'production',

  // Metadata
  createdBy: 'system',
  createdAt: '2025-10-04T00:00:00Z',
  updatedAt: '2025-10-04T00:00:00Z'
};
```

## Sub-Agents Configuration

### 1. Supabase Query Agent (from Phase 4)

```typescript
export const SUPABASE_QUERY_AGENT: AgentConfig = {
  name: 'supabase-query',
  namespace: 'system',
  displayName: 'Supabase Query Agent',
  type: 'tool',
  mode: 'tool',

  toolConfig: {
    mcpServer: 'supabase',
    mcpTool: 'query',
    adapter: 'SupabaseMCPAdapter',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        filters: { type: 'object' },
        aggregates: { type: 'object' },
        groupBy: { type: 'array', items: { type: 'string' } }
      },
      required: ['table']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array' },
        rowCount: { type: 'number' }
      }
    },
    timeout: 30000
  }
};
```

### 2. Chart Generator Agent

```typescript
export const CHART_GENERATOR_AGENT: AgentConfig = {
  name: 'chart-generator',
  namespace: 'system',
  displayName: 'Chart Generator',
  type: 'tool',
  mode: 'tool',

  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.5,
    systemPrompt: `You are a data visualization expert.

Given financial data, create appropriate chart specifications using Chart.js or D3.js format.

Output JSON with:
- type: 'line' | 'bar' | 'pie' | 'area'
- data: formatted for chart library
- options: styling, labels, axes configuration
- insights: key takeaways from the visualization`
  },

  deliverableConfig: {
    generateDeliverable: false, // Inline output, no separate deliverable
    format: 'json'
  }
};
```

### 3. Report Compiler Agent

```typescript
export const REPORT_COMPILER_AGENT: AgentConfig = {
  name: 'report-compiler',
  namespace: 'system',
  displayName: 'Financial Report Compiler',
  type: 'context',
  mode: 'build',

  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.4,
    systemPrompt: `You are a financial report writer.

Given:
- Analysis plan (structure and objectives)
- Metrics data (from database queries)
- Chart specifications (visualizations)

Create a comprehensive financial report in markdown format with:

1. Executive Summary
2. Key Metrics (with numbers from data)
3. Visualizations (embed chart specs)
4. Trend Analysis
5. Insights & Recommendations
6. Appendix (detailed data tables)

Use professional financial reporting language and ensure all numbers are accurate.`
  },

  deliverableConfig: {
    generateDeliverable: true,
    deliverableType: 'financial_report',
    format: 'markdown',
    template: `# {{title}}

## Executive Summary
{{executive_summary}}

## Key Metrics
{{metrics_section}}

## Visualizations
{{charts_section}}

## Trend Analysis
{{trends_section}}

## Insights & Recommendations
{{insights_section}}

## Appendix
{{appendix_section}}

---
*Generated by Finance Manager on {{generated_at}}*`
  }
};
```

## Database Schema Additions

### Financial Reports Table

```sql
-- Store generated financial reports (extends deliverables)
CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id UUID NOT NULL UNIQUE,
  conversation_id UUID NOT NULL,

  -- Report metadata
  report_type VARCHAR(100) NOT NULL, -- 'revenue_analysis', 'expense_breakdown', 'quarterly_summary'
  time_period VARCHAR(100) NOT NULL, -- 'Q1 2025', 'Jan-Mar 2025'
  comparison_period VARCHAR(100),    -- 'Q4 2024' (if comparing)

  -- Data sources
  metrics_data JSONB NOT NULL,       -- Raw metrics from Supabase
  chart_specs JSONB,                 -- Chart configurations

  -- Generated insights
  executive_summary TEXT,
  key_insights TEXT[],
  recommendations TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_financial_reports_deliverable ON financial_reports(deliverable_id);
CREATE INDEX idx_financial_reports_conversation ON financial_reports(conversation_id);
CREATE INDEX idx_financial_reports_type ON financial_reports(report_type);
CREATE INDEX idx_financial_reports_period ON financial_reports(time_period);
```

## Example User Journey

### Step 1: User Initiates Analysis

```typescript
// User message
"Create a Q1 2025 revenue analysis and compare it to Q4 2024.
Include monthly breakdown and trend analysis."

// Frontend request
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'orchestrate',
  agentSlug: 'finance-manager',
  message: 'Create a Q1 2025 revenue analysis and compare it to Q4 2024...'
}
```

### Step 2: Finance Manager Creates Plan

```markdown
# Q1 2025 Revenue Analysis Plan

## Objectives
- Analyze Q1 2025 revenue performance
- Compare against Q4 2024 baseline
- Identify monthly trends and patterns

## Metrics to Retrieve
1. Total revenue by month (Q1 2025)
2. Total revenue by month (Q4 2024)
3. Average transaction value
4. Transaction count
5. Revenue by product category (if available)

## Visualizations
1. Line chart: Monthly revenue trend (Oct 2024 - Mar 2025)
2. Bar chart: Q4 2024 vs Q1 2025 comparison
3. Pie chart: Revenue by category (Q1 2025)

## Report Structure
1. Executive Summary
2. Q1 Performance Metrics
3. Quarter-over-Quarter Comparison
4. Monthly Trend Analysis
5. Insights & Recommendations
6. Detailed Data Appendix

## Data Sources
- Table: `financial_transactions`
- Date Range: 2024-10-01 to 2025-03-31
- Filters: status = 'completed'
```

### Step 3: User Reviews and Approves

```
User: "Looks good, but also include customer acquisition cost if available."

Finance Manager: [Updates plan with CAC metric]

User: "Perfect, build this report."
```

### Step 4: Orchestrator Executes Workflow

```typescript
// Finance Manager orchestrates execution

// 4a. Retrieve metrics via Supabase agent
const metricsResult = {
  success: true,
  data: [
    { month: '2024-10', revenue: 487000, transactions: 1234, avg_value: 394.65 },
    { month: '2024-11', revenue: 523000, transactions: 1356, avg_value: 385.69 },
    { month: '2024-12', revenue: 612000, transactions: 1489, avg_value: 411.02 },
    { month: '2025-01', revenue: 645000, transactions: 1523, avg_value: 423.44 },
    { month: '2025-02', revenue: 701000, transactions: 1678, avg_value: 417.76 },
    { month: '2025-03', revenue: 734000, transactions: 1745, avg_value: 420.63 }
  ],
  rowCount: 6
};

// 4b. Generate charts
const chartSpecs = {
  revenuetrend: {
    type: 'line',
    data: {
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'Monthly Revenue',
        data: [487000, 523000, 612000, 645000, 701000, 734000]
      }]
    },
    insights: ['Strong upward trend', 'Q1 2025 outperformed Q4 2024 by 25%']
  },
  quarterComparison: {
    type: 'bar',
    data: {
      labels: ['Q4 2024', 'Q1 2025'],
      datasets: [{
        label: 'Total Revenue',
        data: [1622000, 2080000]
      }]
    }
  }
};

// 4c. Compile report
const report = `
# Q1 2025 Revenue Analysis

## Executive Summary

Q1 2025 demonstrated strong revenue growth, achieving **$2.08M** in total revenue—a **28.2% increase** over Q4 2024 ($1.62M). Monthly performance showed consistent upward trajectory, with March 2025 reaching the highest monthly revenue of $734K.

## Key Metrics

| Metric | Q4 2024 | Q1 2025 | Change |
|--------|---------|---------|--------|
| **Total Revenue** | $1,622,000 | $2,080,000 | +28.2% |
| **Avg Monthly Revenue** | $540,667 | $693,333 | +28.2% |
| **Total Transactions** | 4,079 | 4,946 | +21.3% |
| **Avg Transaction Value** | $397.65 | $420.61 | +5.8% |

## Visualizations

[Line Chart: Revenue Trend Oct 2024 - Mar 2025]
[Bar Chart: Q4 vs Q1 Comparison]

## Trend Analysis

### Monthly Performance
- **October 2024**: $487K (baseline)
- **November 2024**: $523K (+7.4%)
- **December 2024**: $612K (+17.0%) - Holiday boost
- **January 2025**: $645K (+5.4%) - Strong Q1 start
- **February 2025**: $701K (+8.7%) - Acceleration
- **March 2025**: $734K (+4.7%) - Peak performance

### Key Observations
1. **Consistent Growth**: Every month in Q1 2025 exceeded the previous month
2. **Transaction Volume**: 21.3% increase suggests improved customer acquisition
3. **Transaction Value**: 5.8% increase indicates higher-value purchases or upselling success

## Insights & Recommendations

### Insights
- Q1 momentum is strong and should be leveraged
- December spike suggests seasonal opportunity
- Transaction value growth indicates successful product mix or pricing strategy

### Recommendations
1. **Capitalize on Momentum**: Increase marketing spend to maintain growth trajectory
2. **Seasonal Strategy**: Prepare Q4 2025 campaign based on December 2024 learnings
3. **Customer Retention**: With 21% more transactions, focus on retention to compound growth
4. **Product Analysis**: Investigate which products drove transaction value increase

## Appendix

### Detailed Monthly Data
[Full data table with all metrics]

---
*Generated by Finance Manager on 2025-10-04*
`;

// Save as deliverable
await this.deliverablesService.createDeliverable({
  conversationId: context.conversationId,
  userId: context.userId,
  agentName: 'finance-manager',
  title: 'Q1 2025 Revenue Analysis',
  content: report,
  format: 'markdown',
  type: 'financial_report'
});
```

### Step 5: User Reviews Deliverable

```
User can now:
- View formatted report
- Edit report (creates new version)
- Export to PDF
- Share with team
- Request refinements ("Add competitor comparison")
```

## Implementation Checklist

### Backend

- [ ] Finance Manager orchestrator configuration
- [ ] Chart Generator agent implementation
- [ ] Report Compiler agent implementation
- [ ] Orchestration workflow engine
- [ ] Financial reports table migration
- [ ] Integration tests for full workflow

### Frontend

- [ ] Orchestration mode UI
- [ ] Plan approval workflow
- [ ] Report viewer with chart rendering
- [ ] Export to PDF functionality
- [ ] Share report feature

### Testing

- [ ] Unit tests for each sub-agent
- [ ] Integration test: full Finance Manager flow
- [ ] Test with various time periods and metrics
- [ ] Performance test: < 10s for full report generation

### Documentation

- [ ] Finance Manager user guide
- [ ] Orchestration pattern documentation
- [ ] Template for building similar orchestrators
- [ ] API documentation for orchestration mode

## Success Metrics

### Phase 6 Completion Criteria

1. **Finance Manager Works End-to-End**:
   - [ ] Planning phase creates structured plan
   - [ ] User can review and refine plan
   - [ ] Execution retrieves real metrics from Supabase
   - [ ] Charts are generated accurately
   - [ ] Final report is comprehensive and professional

2. **Performance**:
   - [ ] Full workflow completes in < 15 seconds
   - [ ] Handles errors gracefully (missing data, query failures)
   - [ ] Scales to large datasets (10K+ transactions)

3. **Reusability**:
   - [ ] Finance Manager template available in Agent Builder
   - [ ] Documentation enables building similar orchestrators
   - [ ] Workflow pattern generalizes to other domains

4. **User Validation**:
   - [ ] Non-technical user can request and receive financial report
   - [ ] Report is accurate and actionable
   - [ ] Users prefer this over manual analysis

## Additional Orchestration Examples (Future)

Once Finance Manager is validated, create templates for:

1. **Marketing Manager**
   - Campaign performance analysis
   - ROI calculations
   - Funnel visualization

2. **Operations Dashboard**
   - System health metrics
   - Performance monitoring
   - Alert summaries

3. **Customer Insights**
   - Behavior analysis
   - Segmentation reports
   - Churn prediction

4. **Product Analytics**
   - Feature usage metrics
   - A/B test results
   - User feedback synthesis

## Open Questions

1. Should orchestrators support conditional branching (if metric X, then run agent Y)?
2. How do we handle long-running workflows (> 30 seconds)?
3. Should we support human-in-the-loop for orchestrations?
4. How do we version orchestration workflows independently of agents?
5. Should we build a visual workflow editor for orchestrations?

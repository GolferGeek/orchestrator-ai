# KPI Business Database Schema - Complete Reference

## Table Definitions and Usage Patterns

### 1. companies - Business Entities
**Purpose**: Stores information about companies/organizations being tracked
**Columns**:
- `id` (PRIMARY KEY): Unique company identifier  
- `name`: Company name (e.g., "Acme Corp", "TechStart LLC")
- `industry`: Business sector (e.g., "Technology", "Manufacturing", "Healthcare") 
- `founded_year`: Year company was established (e.g., 2010, 1995)
- `created_at`: When record was added to database

**When to use**: 
- Counting companies: "How many companies..."
- Company details: "Show me companies in technology industry"
- Company-level aggregations: "Which companies have the highest revenue"

**Common patterns**:
```sql
-- Count all companies
SELECT COUNT(*) FROM companies LIMIT 1

-- Companies by industry  
SELECT industry, COUNT(*) FROM companies GROUP BY industry LIMIT 100

-- Specific company details
SELECT name, industry, founded_year FROM companies WHERE name LIKE '%Acme%' LIMIT 10
```

### 2. departments - Company Departments
**Purpose**: Organizational units within companies (Sales, Marketing, Engineering, etc.)
**Columns**:
- `id` (PRIMARY KEY): Unique department identifier
- `company_id` (FOREIGN KEY): Links to companies.id - which company this department belongs to
- `name`: Department name (e.g., "Sales", "Marketing", "Engineering", "HR")
- `head_of_department`: Name of department manager/director
- `budget`: Annual department budget in dollars
- `created_at`: When record was added

**When to use**:
- Department-level analysis: "Show me sales departments"
- Budget analysis: "Which departments have highest budgets"
- **CRITICAL**: Bridge table between companies and KPI data - ALWAYS needed for company-level KPI queries

**Common patterns**:
```sql
-- Departments by company (SUPABASE COMPATIBLE)
SELECT companies.name, departments.name, budget 
FROM companies 
JOIN departments ON companies.id = departments.company_id 
LIMIT 100

-- Total budget by company (SUPABASE COMPATIBLE)
SELECT companies.name, SUM(budget) as total_budget
FROM companies 
JOIN departments ON companies.id = departments.company_id 
GROUP BY companies.id, companies.name 
LIMIT 100
```

### 3. kpi_metrics - Metric Definitions  
**Purpose**: Defines what metrics are being tracked (like a data dictionary)
**Columns**:
- `id` (PRIMARY KEY): Unique metric identifier
- `name`: Metric name (e.g., "Monthly Revenue", "Customer Count", "Employee Satisfaction", "Website Traffic")
- `description`: Detailed explanation of what this metric measures
- `unit`: Unit of measurement (e.g., "USD", "Count", "Percentage", "Hours")
- `metric_type`: Category of metric (e.g., "Financial", "Operational", "Customer", "Employee")
- `created_at`: When metric definition was added

**When to use**:
- Finding available metrics: "What metrics do we track"
- Understanding metric definitions: "Show me all financial metrics"
- **CRITICAL**: Always join with kpi_data to get actual metric values

**Common patterns**:
```sql
-- All available metrics
SELECT name, description, unit, metric_type FROM kpi_metrics LIMIT 100

-- Financial metrics only
SELECT name, description FROM kpi_metrics WHERE metric_type = 'Financial' LIMIT 50

-- Find specific metric
SELECT id, name, unit FROM kpi_metrics WHERE name LIKE '%Revenue%' LIMIT 10
```

### 4. kpi_data - Actual Metric Values (THE MAIN DATA TABLE)
**Purpose**: Contains the actual measured values for each metric by department and date
**Columns**:
- `id` (PRIMARY KEY): Unique record identifier
- `department_id` (FOREIGN KEY): Links to departments.id - which department recorded this value
- `metric_id` (FOREIGN KEY): Links to kpi_metrics.id - which metric this value represents  
- `value`: The actual measured value (e.g., 150000.00 for $150k revenue, 85.5 for 85.5% satisfaction)
- `date_recorded`: The date this measurement was taken (NOT created_at) - use this for time filtering
- `created_at`: When record was added to database

**When to use**:
- ALL actual business data queries: "sales", "revenue", "performance", "metrics"
- Time-based analysis: "last year", "this month", "trending"
- **MOST IMPORTANT TABLE** - contains all the actual business numbers

**Critical patterns for business queries**:
```sql
-- Companies with sales/revenue last year
SELECT COUNT(DISTINCT c.id) as companies_with_sales
FROM companies c
JOIN departments d ON c.id = d.company_id  
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_metrics m ON k.metric_id = m.id
WHERE m.name = 'Monthly Revenue'
AND EXTRACT(YEAR FROM k.date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE) - 1
LIMIT 1

-- Top performing companies by revenue (SUPABASE COMPATIBLE)
SELECT name, SUM(value) as total_revenue
FROM companies 
JOIN departments ON companies.id = departments.company_id
JOIN kpi_data ON departments.id = kpi_data.department_id  
JOIN kpi_metrics ON kpi_data.metric_id = kpi_metrics.id
WHERE kpi_metrics.name = 'Monthly Revenue'
AND kpi_data.date_recorded >= NOW() - INTERVAL '12 months'
GROUP BY companies.id, companies.name
ORDER BY total_revenue DESC
LIMIT 10
```

### 5. kpi_goals - Target Values
**Purpose**: Stores target/goal values that departments aim to achieve for specific metrics
**Columns**:
- `id` (PRIMARY KEY): Unique goal identifier
- `department_id` (FOREIGN KEY): Links to departments.id - which department set this goal
- `metric_id` (FOREIGN KEY): Links to kpi_metrics.id - which metric this goal is for
- `target_value`: The goal/target value to achieve
- `period_start`: Start date of goal period
- `period_end`: End date of goal period  
- `created_at`: When goal was set

**When to use**:
- Goal tracking: "Are we meeting our targets"
- Performance comparison: "Actual vs goal performance"
- Target analysis: "What are our revenue goals"

**Common patterns**:
```sql
-- Actual vs Goal performance (SUPABASE COMPATIBLE)
SELECT companies.name, 
       AVG(value) as actual_avg,
       target_value as goal,
       (AVG(value) / target_value * 100) as achievement_percent
FROM companies
JOIN departments ON companies.id = departments.company_id
JOIN kpi_data ON departments.id = kpi_data.department_id
JOIN kpi_goals ON departments.id = kpi_goals.department_id AND kpi_data.metric_id = kpi_goals.metric_id
JOIN kpi_metrics ON kpi_data.metric_id = kpi_metrics.id  
WHERE kpi_metrics.name = 'Monthly Revenue'
GROUP BY companies.id, companies.name, kpi_goals.target_value
LIMIT 100
```

## Business Query Translation Rules

### "Sales" or "Revenue" Queries → Use Monthly Revenue metric
- Always filter: `WHERE kpi_metrics.name = 'Monthly Revenue'`
- Always join all 4 tables: companies → departments → kpi_data ← kpi_metrics

### "Companies with sales" → Count distinct companies with revenue data
- Pattern: `COUNT(DISTINCT companies.id)`
- Must join through departments table
- Filter by time period using `kpi_data.date_recorded`

### Time Period Filters (use kpi_data.date_recorded):
- "last year": `EXTRACT(YEAR FROM date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE) - 1`
- "this year": `EXTRACT(YEAR FROM date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE)`
- "last 12 months": `date_recorded >= NOW() - INTERVAL '12 months'`

### CRITICAL: Required Supabase PostgREST Constraints:

⚠️ **THESE RULES ARE MANDATORY - QUERIES WILL FAIL IF NOT FOLLOWED:**

1. **NO TABLE ALIASES IN SELECT COLUMNS**
   - ❌ WRONG: `SELECT c.name, k.value FROM companies c`
   - ✅ CORRECT: `SELECT companies.name, value FROM companies`
   - ❌ WRONG: `SELECT SUM(k.value) FROM kpi_data k`  
   - ✅ CORRECT: `SELECT SUM(value) FROM kpi_data`

2. **ALWAYS ADD LIMIT CLAUSE**
   - Use `LIMIT 1` for counts and aggregations
   - Use `LIMIT 100` for data lists
   - ❌ WRONG: `SELECT COUNT(*) FROM companies`
   - ✅ CORRECT: `SELECT COUNT(*) FROM companies LIMIT 1`

3. **USE FULL TABLE NAMES IN SELECT**
   - ❌ WRONG: `SELECT name FROM companies c JOIN departments d`
   - ✅ CORRECT: `SELECT companies.name FROM companies JOIN departments`
   - When column is ambiguous, use `table.column` format

4. **COUNT DISTINCT FOR ENTITY COUNTS**
   - ❌ WRONG: `COUNT(*)`
   - ✅ CORRECT: `COUNT(DISTINCT table.id)`

**Note**: Table aliases are OK in FROM/JOIN/WHERE clauses, just NOT in SELECT columns
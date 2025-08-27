# Orchestrator AI - KPI & Analytics Schema

## Database: Supabase PostgreSQL (KPI Domain)
**Schema:** public  
**Domain:** KPI & Analytics  
**Purpose:** Business metrics, performance tracking, company analytics

---

## KPI Tables

### public.companies
**Purpose:** Company information and business details
```sql
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL, -- Company name (NOT company_name!)
  industry VARCHAR(255),
  founded_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.departments
**Purpose:** Organizational structure and department management
```sql
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name VARCHAR(255) NOT NULL,
  head_of_department VARCHAR(255),
  budget NUMERIC,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
```

### public.kpi_metrics
**Purpose:** Key performance indicator definitions and metadata
```sql
CREATE TABLE public.kpi_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(255),
  metric_type VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
```

### public.kpi_goals
**Purpose:** Target values and goals for each metric by department
```sql
CREATE TABLE public.kpi_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID,
  metric_id UUID,
  target_value NUMERIC,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
```

### public.kpi_data
**Purpose:** Historical performance data and actual measurements
```sql
CREATE TABLE public.kpi_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID,
  metric_id UUID,
  value NUMERIC,
  date_recorded DATE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
```

---

## Indexes and Performance

### Primary Indexes
- All tables have UUID primary keys
- Foreign keys automatically indexed

### Additional Indexes
```sql
-- KPI data by department and date (most common query)
CREATE INDEX idx_kpi_data_dept_date ON kpi_data(department_id, date_recorded DESC);

-- KPI data by metric and date (for metric analysis)
CREATE INDEX idx_kpi_data_metric_date ON kpi_data(metric_id, date_recorded DESC);

-- Company lookup by name
CREATE INDEX idx_companies_name ON companies(name);

-- Departments by company
CREATE INDEX idx_departments_company ON departments(company_id, name);

-- Active metrics
CREATE INDEX idx_kpi_metrics_active ON kpi_metrics(is_active, metric_type) WHERE is_active = true;

-- Current goals
CREATE INDEX idx_kpi_goals_current ON kpi_goals(department_id, metric_id, period_start, period_end);
```

---

## Common Query Patterns

### Revenue by Company (Total)
```sql
SELECT c.name as company, 
       SUM(kd.value) as total_revenue
FROM companies c
JOIN departments d ON c.id = d.company_id
JOIN kpi_data kd ON d.id = kd.department_id
JOIN kpi_metrics km ON kd.metric_id = km.id
WHERE km.name = 'Revenue' 
  AND kd.date_recorded >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY c.id, c.name
ORDER BY total_revenue DESC
LIMIT 10;
```

### Department Performance vs Goals
```sql
SELECT d.name as department,
       km.name as metric,
       kg.target_value,
       AVG(kd.value) as average_actual,
       CASE 
         WHEN AVG(kd.value) >= kg.target_value THEN 'Meeting Goal'
         ELSE 'Below Goal' 
       END as performance_status
FROM departments d
JOIN kpi_goals kg ON d.id = kg.department_id
JOIN kpi_metrics km ON kg.metric_id = km.id
JOIN kpi_data kd ON d.id = kd.department_id AND km.id = kd.metric_id
WHERE kg.period_start <= CURRENT_DATE 
  AND kg.period_end >= CURRENT_DATE
  AND kd.date_recorded >= kg.period_start
  AND kd.date_recorded <= kg.period_end
GROUP BY d.id, d.name, km.name, kg.target_value
ORDER BY d.name, km.name;
```

### Monthly Revenue Trends
```sql
SELECT DATE_TRUNC('month', kd.date_recorded) as month,
       SUM(kd.value) as monthly_revenue
FROM kpi_data kd
JOIN kpi_metrics km ON kd.metric_id = km.id
WHERE km.name = 'Revenue'
  AND kd.date_recorded >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', kd.date_recorded)
ORDER BY month;
```

### Top Performing Departments
```sql
SELECT d.name as department,
       c.name as company,
       COUNT(DISTINCT kd.metric_id) as metrics_tracked,
       AVG(kd.value) as average_performance
FROM departments d
JOIN companies c ON d.company_id = c.id  
JOIN kpi_data kd ON d.id = kd.department_id
WHERE kd.date_recorded >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY d.id, d.name, c.name
HAVING COUNT(DISTINCT kd.metric_id) >= 3
ORDER BY average_performance DESC
LIMIT 5;
```

### Metric Definitions by Category
```sql
SELECT metric_type,
       COUNT(*) as metric_count,
       STRING_AGG(name, ', ') as metrics
FROM kpi_metrics 
WHERE is_active = true
GROUP BY metric_type
ORDER BY metric_count DESC;
```

---

## Data Relationships

### Core Relationships
- `companies` → `departments` (1:many)
- `departments` → `kpi_goals` (1:many)
- `departments` → `kpi_data` (1:many)
- `kpi_metrics` → `kpi_goals` (1:many)
- `kpi_metrics` → `kpi_data` (1:many)

### Key Join Patterns
- Company → Department → KPI Data (for company-level metrics)
- Metric → Goals + Data (for performance vs target analysis)
- Department → Goals + Data + Metrics (for department dashboards)

---

## Critical Schema Notes

### ⚠️ IMPORTANT: Column Names
- Companies table uses `name` column, **NOT** `company_name`
- Always reference `companies.name` in queries
- Revenue data is in `kpi_data` table, not directly in companies
- **Companies table does NOT have a status column**
- **Many optional columns in context examples don't exist in actual database**

### Metric Name Standards
Common metric names in the database:
- "Revenue" (financial)
- "Customer Satisfaction" (customer) 
- "Employee Retention" (employee)
- "Lead Conversion Rate" (operational)
- "Cost per Acquisition" (financial)

### Date Handling
- `kpi_data.date_recorded` is DATE type (no time)
- Use `>=` and `<=` for date range queries
- `created_at`/`updated_at` are TIMESTAMP WITH TIME ZONE

---

## SQL Generation Guidelines

### Table Aliases
- `c` = companies
- `d` = departments
- `km` = kpi_metrics
- `kg` = kpi_goals
- `kd` = kpi_data

### Performance Notes
- Always use LIMIT clauses to prevent large result sets
- Filter by date ranges early in WHERE clauses
- Use appropriate GROUP BY for aggregations
- Join companies → departments → kpi_data for company-level metrics

### Common WHERE Patterns
- Recent data: `WHERE date_recorded >= CURRENT_DATE - INTERVAL '6 months'`
- Revenue queries: `WHERE km.name = 'Revenue'`
- Financial metrics: `WHERE km.metric_type = 'financial'`
- USD values: `WHERE km.unit = 'USD'`
- **Note: No status columns exist in any KPI tables**

### Aggregation Patterns
- Total revenue: `SUM(kd.value)`
- Average performance: `AVG(kd.value)`
- Monthly grouping: `DATE_TRUNC('month', kd.date_recorded)`
- Performance vs goals: `AVG(kd.value) >= kg.target_value`
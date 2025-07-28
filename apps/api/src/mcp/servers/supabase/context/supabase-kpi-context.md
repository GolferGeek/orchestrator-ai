# Supabase KPI Schema Context

## KPI Database Schema

### Core KPI Tables
- **companies**: Company records with `id`, `name`, `industry`, `founded_year`, `created_at`
- **departments**: Department records with `id`, `company_id`, `name`, `head_of_department`, `budget`, `created_at`
- **kpi_metrics**: Metric definitions with `id`, `name`, `description`, `unit`, `metric_type`, `created_at`
- **kpi_data**: Actual metric values with `id`, `department_id`, `metric_id`, `value`, `date_recorded`, `created_at`
- **kpi_goals**: Target values with `id`, `department_id`, `metric_id`, `target_value`, `period_start`, `period_end`, `created_at`

### Table Relationships
- Companies → Departments: `companies.id = departments.company_id`
- Departments → KPI Data: `departments.id = kpi_data.department_id`
- Metrics → KPI Data: `kpi_metrics.id = kpi_data.metric_id`
- Departments → Goals: `departments.id = kpi_goals.department_id`
- Metrics → Goals: `kpi_metrics.id = kpi_goals.metric_id`

### Key Schema Details
- All tables use `created_at` timestamps (PostgreSQL TIMESTAMP)
- Foreign keys: `company_id` references companies, `department_id` references departments, `metric_id` references kpi_metrics
- KPI data uses `date_recorded` for when the metric was measured (DATE type)
- Metric values are stored as NUMERIC in `kpi_data.value` and `kpi_goals.target_value`
- **NO direct company_id in kpi_data** - must join through departments

## Common KPI Query Patterns

### Company-Level Metrics
To get metrics for companies, you MUST join through departments:
```sql
SELECT c.name, m.name as metric_name, k.value, k.date_recorded
FROM companies c
JOIN departments d ON c.id = d.company_id
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_metrics m ON k.metric_id = m.id
WHERE m.name = 'Monthly Revenue'
```

### Counting Companies with Metrics
```sql
SELECT COUNT(DISTINCT c.id) as companies_with_sales
FROM companies c
JOIN departments d ON c.id = d.company_id
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_metrics m ON k.metric_id = m.id
WHERE m.name = 'Monthly Revenue'
AND k.date_recorded >= '2024-01-01'
AND k.date_recorded < '2025-01-01'
```

### Year-Based Filtering
- For "last year": `EXTRACT(YEAR FROM date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE) - 1`
- For 2024: `date_recorded >= '2024-01-01' AND date_recorded < '2025-01-01'`
- For current year: `EXTRACT(YEAR FROM date_recorded) = EXTRACT(YEAR FROM CURRENT_DATE)`

### Department-Level Analysis
```sql
SELECT d.name as department, m.name as metric, k.value
FROM departments d
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_metrics m ON k.metric_id = m.id
WHERE d.company_id = 'company-uuid-here'
```

### Performance vs Goals
```sql
SELECT 
    c.name as company,
    m.name as metric,
    k.value as actual,
    g.target_value as target,
    (k.value / g.target_value * 100) as percentage_of_target
FROM companies c
JOIN departments d ON c.id = d.company_id
JOIN kpi_data k ON d.id = k.department_id
JOIN kpi_goals g ON d.id = g.department_id AND k.metric_id = g.metric_id
JOIN kpi_metrics m ON k.metric_id = m.id
```

## Common Metric Names
Based on the data, common metric names include:
- "Monthly Revenue" (financial metric)
- "Customer Satisfaction" (performance metric)
- Sales-related metrics typically use "Revenue" or "Sales" in the name

## Error Prevention
- **Never use `company_id` in kpi_data** - it doesn't exist, use department_id
- **Always join through departments** for company-level metrics
- **Use proper date filtering** with date_recorded column
- **Match metric names exactly** - they are case-sensitive strings
- **Include metric type filtering** when needed: `WHERE metric_type = 'financial'`
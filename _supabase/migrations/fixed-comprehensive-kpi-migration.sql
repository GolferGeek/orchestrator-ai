-- =====================================================
-- Fixed Comprehensive KPI Test Data Migration
-- =====================================================
-- This script creates a LOT of realistic test data for comprehensive KPI analysis
-- Handles existing data properly and creates extensive datasets

BEGIN;

-- =====================================================
-- 1. INSERT COMPANIES (Create if empty, use existing if populated)
-- =====================================================

-- Check if companies table is empty and insert base companies
INSERT INTO companies (id, name, industry, founded_year, created_at)
SELECT * FROM (VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'TechCorp Industries', 'Technology', 2018, NOW()),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'RetailMax Solutions', 'Retail', 2015, NOW()),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'ServicePro Consulting', 'Consulting', 2020, NOW()),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Manufacturing Global', 'Manufacturing', 2010, NOW()),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'HealthTech Medical', 'Healthcare', 2019, NOW()),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'GreenEnergy Corp', 'Energy', 2017, NOW()),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'FinanceFirst Bank', 'Financial', 2012, NOW()),
  ('88888888-8888-8888-8888-888888888888'::uuid, 'EduTech Solutions', 'Education', 2021, NOW()),
  ('99999999-9999-9999-9999-999999999999'::uuid, 'LogisticsPro Ltd', 'Logistics', 2016, NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'CloudData Systems', 'Cloud Computing', 2019, NOW())
) AS v(id, name, industry, founded_year, created_at)
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE id = v.id);

-- =====================================================
-- 2. INSERT COMPREHENSIVE DEPARTMENTS
-- =====================================================

-- Create departments for each company that exists
INSERT INTO departments (id, company_id, name, head_of_department, budget, created_at)
SELECT 
  gen_random_uuid(),
  company_id,
  dept_name,
  dept_head,
  dept_budget,
  NOW()
FROM (
  SELECT id as company_id FROM companies LIMIT 10
) companies
CROSS JOIN (VALUES
  ('Sales', 'John Smith', 500000),
  ('Marketing', 'Sarah Johnson', 350000),
  ('Engineering', 'Mike Chen', 800000),
  ('Human Resources', 'Lisa Anderson', 250000),
  ('Finance', 'Robert Wilson', 300000),
  ('Operations', 'Jennifer Davis', 600000),
  ('Customer Support', 'David Kumar', 200000),
  ('Research & Development', 'Dr. Emily Watson', 1000000),
  ('Quality Assurance', 'Alex Thompson', 180000),
  ('Product Management', 'Maria Rodriguez', 450000)
) AS depts(dept_name, dept_head, dept_budget);

-- =====================================================
-- 3. INSERT COMPREHENSIVE KPI METRICS
-- =====================================================

INSERT INTO kpi_metrics (id, name, description, unit, metric_type, created_at)
VALUES
-- Financial Metrics
('a1111111-1111-1111-1111-111111111111'::uuid, 'Monthly Revenue', 'Total revenue generated per month', 'USD', 'financial', NOW()),
('a1222222-2222-2222-2222-222222222222'::uuid, 'Quarterly Revenue', 'Total revenue generated per quarter', 'USD', 'financial', NOW()),
('a1333333-3333-3333-3333-333333333333'::uuid, 'Gross Profit Margin', 'Percentage of revenue after COGS', 'percentage', 'financial', NOW()),
('a1444444-4444-4444-4444-444444444444'::uuid, 'Operating Expenses', 'Total operational costs per period', 'USD', 'financial', NOW()),
('a1555555-5555-5555-5555-555555555555'::uuid, 'Customer Acquisition Cost', 'Average cost to acquire new customer', 'USD', 'financial', NOW()),
('a1666666-6666-6666-6666-666666666666'::uuid, 'Customer Lifetime Value', 'Total value from customer relationship', 'USD', 'financial', NOW()),
('a1777777-7777-7777-7777-777777777777'::uuid, 'Return on Investment', 'ROI percentage for initiatives', 'percentage', 'financial', NOW()),

-- Sales Metrics  
('a2111111-1111-1111-1111-111111111111'::uuid, 'Sales Conversion Rate', 'Percentage of leads converting to sales', 'percentage', 'sales', NOW()),
('a2222222-2222-2222-2222-222222222222'::uuid, 'Average Deal Size', 'Average value of closed deals', 'USD', 'sales', NOW()),
('a2333333-3333-3333-3333-333333333333'::uuid, 'Sales Cycle Length', 'Average days from lead to close', 'days', 'sales', NOW()),
('a2444444-4444-4444-4444-444444444444'::uuid, 'Monthly Recurring Revenue', 'Predictable monthly revenue', 'USD', 'sales', NOW()),
('a2555555-5555-5555-5555-555555555555'::uuid, 'Customer Churn Rate', 'Percentage of customers lost per period', 'percentage', 'sales', NOW()),
('a2666666-6666-6666-6666-666666666666'::uuid, 'Lead Generation Rate', 'Number of leads generated per period', 'count', 'sales', NOW()),
('a2777777-7777-7777-7777-777777777777'::uuid, 'Sales Team Productivity', 'Revenue per sales representative', 'USD', 'sales', NOW()),

-- Operational Metrics
('a3111111-1111-1111-1111-111111111111'::uuid, 'Production Efficiency', 'Units produced per hour', 'units/hour', 'operational', NOW()),
('a3222222-2222-2222-2222-222222222222'::uuid, 'Defect Rate', 'Percentage of products with issues', 'percentage', 'quality', NOW()),
('a3333333-3333-3333-3333-333333333333'::uuid, 'On-Time Delivery', 'Percentage of orders delivered on time', 'percentage', 'operational', NOW()),
('a3444444-4444-4444-4444-444444444444'::uuid, 'Inventory Turnover', 'Times inventory sold per period', 'ratio', 'operational', NOW()),
('a3555555-5555-5555-5555-555555555555'::uuid, 'Server Uptime', 'Percentage of system availability', 'percentage', 'technical', NOW()),
('a3666666-6666-6666-6666-666666666666'::uuid, 'Processing Time', 'Average time to complete processes', 'hours', 'operational', NOW()),

-- Human Resources Metrics
('a4111111-1111-1111-1111-111111111111'::uuid, 'Employee Retention Rate', 'Percentage of employees retained', 'percentage', 'hr', NOW()),
('a4222222-2222-2222-2222-222222222222'::uuid, 'Time to Fill Position', 'Days to hire for open positions', 'days', 'hr', NOW()),
('a4333333-3333-3333-3333-333333333333'::uuid, 'Training Hours per Employee', 'Training hours per employee per period', 'hours', 'hr', NOW()),
('a4444444-4444-4444-4444-444444444444'::uuid, 'Employee Net Promoter Score', 'Employee satisfaction score', 'score', 'hr', NOW()),
('a4555555-5555-5555-5555-555555555555'::uuid, 'Absenteeism Rate', 'Percentage of work time missed', 'percentage', 'hr', NOW()),
('a4666666-6666-6666-6666-666666666666'::uuid, 'Employee Productivity', 'Output per employee per period', 'units', 'hr', NOW()),

-- Customer Success Metrics
('a5111111-1111-1111-1111-111111111111'::uuid, 'Customer Satisfaction Score', 'Customer satisfaction rating', 'score', 'customer', NOW()),
('a5222222-2222-2222-2222-222222222222'::uuid, 'Support Response Time', 'Hours to first response', 'hours', 'customer', NOW()),
('a5333333-3333-3333-3333-333333333333'::uuid, 'First Call Resolution Rate', 'Issues resolved on first contact', 'percentage', 'customer', NOW()),
('a5444444-4444-4444-4444-444444444444'::uuid, 'Net Promoter Score', 'Customer loyalty measurement', 'score', 'customer', NOW()),
('a5555555-5555-5555-5555-555555555555'::uuid, 'Support Ticket Volume', 'Support requests per period', 'count', 'customer', NOW()),
('a5666666-6666-6666-6666-666666666666'::uuid, 'Customer Onboarding Time', 'Days to fully onboard new customer', 'days', 'customer', NOW()),

-- Marketing Metrics
('a6111111-1111-1111-1111-111111111111'::uuid, 'Website Conversion Rate', 'Website visitors taking desired action', 'percentage', 'marketing', NOW()),
('a6222222-2222-2222-2222-222222222222'::uuid, 'Cost Per Lead', 'Marketing cost to generate a lead', 'USD', 'marketing', NOW()),
('a6333333-3333-3333-3333-333333333333'::uuid, 'Email Open Rate', 'Percentage of emails opened', 'percentage', 'marketing', NOW()),
('a6444444-4444-4444-4444-444444444444'::uuid, 'Social Media Engagement', 'Interactions per social post', 'count', 'marketing', NOW()),
('a6555555-5555-5555-5555-555555555555'::uuid, 'Brand Awareness Score', 'Brand recognition measurement', 'score', 'marketing', NOW()),
('a6666666-6666-6666-6666-666666666666'::uuid, 'Marketing ROI', 'Return on marketing investment', 'percentage', 'marketing', NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. INSERT KPI GOALS FOR ALL DEPARTMENTS
-- =====================================================

-- Create realistic goals for all department/metric combinations
INSERT INTO kpi_goals (id, department_id, metric_id, target_value, period_start, period_end, created_at)
SELECT 
  gen_random_uuid(),
  d.id,
  m.id,
  CASE 
    -- Financial targets
    WHEN m.unit = 'USD' AND m.name LIKE '%Revenue%' AND m.name LIKE '%Monthly%' THEN (RANDOM() * 1500000 + 800000)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Revenue%' AND m.name LIKE '%Quarterly%' THEN (RANDOM() * 4500000 + 2400000)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Expenses%' THEN (RANDOM() * 500000 + 200000)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Cost%' THEN (RANDOM() * 800 + 200)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Value%' THEN (RANDOM() * 15000 + 5000)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Deal%' THEN (RANDOM() * 75000 + 25000)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Lead%' THEN (RANDOM() * 150 + 50)::numeric
    WHEN m.unit = 'USD' AND m.name LIKE '%Productivity%' THEN (RANDOM() * 200000 + 100000)::numeric
    
    -- Percentage targets
    WHEN m.unit = 'percentage' AND m.name LIKE '%Conversion%' THEN (RANDOM() * 20 + 15)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Margin%' THEN (RANDOM() * 25 + 20)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Retention%' THEN (RANDOM() * 15 + 85)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Churn%' THEN (RANDOM() * 8 + 2)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Delivery%' THEN (RANDOM() * 10 + 90)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Uptime%' THEN (RANDOM() * 5 + 95)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Resolution%' THEN (RANDOM() * 20 + 70)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Defect%' THEN (RANDOM() * 3 + 1)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Open%' THEN (RANDOM() * 15 + 25)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Website%' THEN (RANDOM() * 5 + 3)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%Absenteeism%' THEN (RANDOM() * 3 + 2)::numeric
    WHEN m.unit = 'percentage' AND m.name LIKE '%ROI%' THEN (RANDOM() * 100 + 50)::numeric
    WHEN m.unit = 'percentage' THEN (RANDOM() * 30 + 70)::numeric
    
    -- Time-based targets
    WHEN m.unit = 'days' AND m.name LIKE '%Cycle%' THEN (RANDOM() * 20 + 10)::numeric
    WHEN m.unit = 'days' AND m.name LIKE '%Fill%' THEN (RANDOM() * 25 + 15)::numeric
    WHEN m.unit = 'days' AND m.name LIKE '%Onboarding%' THEN (RANDOM() * 10 + 5)::numeric
    WHEN m.unit = 'days' THEN (RANDOM() * 15 + 5)::numeric
    WHEN m.unit = 'hours' AND m.name LIKE '%Response%' THEN (RANDOM() * 6 + 2)::numeric
    WHEN m.unit = 'hours' AND m.name LIKE '%Training%' THEN (RANDOM() * 30 + 20)::numeric
    WHEN m.unit = 'hours' AND m.name LIKE '%Processing%' THEN (RANDOM() * 4 + 1)::numeric
    WHEN m.unit = 'hours' THEN (RANDOM() * 8 + 2)::numeric
    
    -- Score targets (1-100 scale)
    WHEN m.unit = 'score' THEN (RANDOM() * 25 + 75)::numeric
    
    -- Count targets
    WHEN m.unit = 'count' AND m.name LIKE '%Lead%' THEN (RANDOM() * 400 + 200)::numeric
    WHEN m.unit = 'count' AND m.name LIKE '%Ticket%' THEN (RANDOM() * 150 + 50)::numeric
    WHEN m.unit = 'count' AND m.name LIKE '%Engagement%' THEN (RANDOM() * 80 + 20)::numeric
    WHEN m.unit = 'count' THEN (RANDOM() * 300 + 100)::numeric
    
    -- Units and ratios
    WHEN m.unit = 'units/hour' THEN (RANDOM() * 40 + 30)::numeric
    WHEN m.unit = 'units' THEN (RANDOM() * 500 + 200)::numeric
    WHEN m.unit = 'ratio' THEN (RANDOM() * 8 + 4)::numeric
    
    -- Default
    ELSE (RANDOM() * 100 + 50)::numeric
  END,
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  NOW()
FROM departments d
CROSS JOIN kpi_metrics m
WHERE RANDOM() > 0.2; -- Create goals for ~80% of combinations

-- =====================================================
-- 5. INSERT MASSIVE HISTORICAL KPI DATA (6 months)
-- =====================================================

-- Generate comprehensive historical data
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '180 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date as measurement_date
),
dept_metric_goals AS (
  SELECT 
    d.id as department_id,
    m.id as metric_id,
    d.name as dept_name,
    m.name as metric_name,
    m.unit,
    COALESCE(g.target_value, 
      CASE 
        WHEN m.unit = 'USD' AND m.name LIKE '%Revenue%' AND m.name LIKE '%Monthly%' THEN 1000000
        WHEN m.unit = 'USD' AND m.name LIKE '%Revenue%' AND m.name LIKE '%Quarterly%' THEN 3000000
        WHEN m.unit = 'USD' AND m.name LIKE '%Cost%' THEN 500
        WHEN m.unit = 'USD' AND m.name LIKE '%Value%' THEN 10000
        WHEN m.unit = 'USD' AND m.name LIKE '%Deal%' THEN 50000
        WHEN m.unit = 'percentage' THEN 80
        WHEN m.unit = 'days' THEN 15
        WHEN m.unit = 'hours' THEN 4
        WHEN m.unit = 'score' THEN 85
        WHEN m.unit = 'count' THEN 250
        WHEN m.unit = 'units/hour' THEN 35
        WHEN m.unit = 'units' THEN 350
        WHEN m.unit = 'ratio' THEN 6
        ELSE 75
      END
    ) as target_value
  FROM departments d
  CROSS JOIN kpi_metrics m
  LEFT JOIN kpi_goals g ON d.id = g.department_id AND m.id = g.metric_id
)
INSERT INTO kpi_data (id, department_id, metric_id, value, date_recorded, created_at)
SELECT 
  gen_random_uuid(),
  dmg.department_id,
  dmg.metric_id,
  ROUND((
    dmg.target_value * 
    (0.7 + RANDOM() * 0.6) * -- Base variance ±30%
    (1 + EXTRACT(DOY FROM ds.measurement_date) / 365.0 * 0.3) * -- Growth trend
    (1 + SIN(EXTRACT(DOY FROM ds.measurement_date) * 2 * PI() / 365) * 0.1) -- Seasonal variation
  )::numeric, 2),
  ds.measurement_date,
  NOW()
FROM date_series ds
CROSS JOIN dept_metric_goals dmg
WHERE RANDOM() > 0.05; -- Skip ~5% to simulate missing data

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show comprehensive record counts
SELECT 'companies' as table_name, COUNT(*) as record_count FROM companies
UNION ALL
SELECT 'departments', COUNT(*) FROM departments  
UNION ALL
SELECT 'kpi_metrics', COUNT(*) FROM kpi_metrics
UNION ALL
SELECT 'kpi_goals', COUNT(*) FROM kpi_goals
UNION ALL
SELECT 'kpi_data', COUNT(*) FROM kpi_data
ORDER BY table_name;

-- Show data distribution by metric type
SELECT 
  m.metric_type,
  COUNT(DISTINCT m.id) as metrics_count,
  COUNT(kd.id) as data_points,
  ROUND(AVG(kd.value), 2) as avg_value
FROM kpi_metrics m
LEFT JOIN kpi_data kd ON m.id = kd.metric_id
GROUP BY m.metric_type
ORDER BY m.metric_type;

-- Show recent sample data
SELECT 
  c.name as company,
  d.name as department,
  m.name as metric,
  kd.value,
  m.unit,
  kd.date_recorded
FROM kpi_data kd
JOIN departments d ON kd.department_id = d.id
JOIN companies c ON d.company_id = c.id  
JOIN kpi_metrics m ON kd.metric_id = m.id
WHERE kd.date_recorded >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY kd.date_recorded DESC, c.name, d.name
LIMIT 20;
-- Seed Phase 5 KPI tracking orchestration definition
-- Created: 2025-10-12

DO $$
DECLARE
  definition jsonb;
BEGIN
  definition := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'kpi-tracking',
      'displayName', 'KPI Tracking Orchestration',
      'version', '1.0.0',
      'description', 'Fetch and analyze KPI metrics from database'
    ),
    'orchestration',
    jsonb_build_object(
      'steps',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'fetch-kpi-data',
          'name', 'Fetch KPI Data',
          'agent', 'supabase-agent',
          'mode', 'BUILD',
          'input',
          jsonb_build_object(
            'userMessage',
            E'Fetch KPI metrics for: {{ kpi_names }}\nTime range: {{ start_date }} to {{ end_date }}\nGroup by: {{ grouping }}\n\nUse schema introspection to understand table structure,\nthen build and execute the appropriate query.',
            'context',
            jsonb_build_object(
              'kpiNames', '{{ kpi_names }}',
              'startDate', '{{ start_date }}',
              'endDate', '{{ end_date }}',
              'grouping', '{{ grouping }}'
            )
          ),
          'checkpoint_after',
          jsonb_build_object(
            'question', 'Review KPI query results before summarizing?',
            'required', false,
            'options',
            jsonb_build_array(
              jsonb_build_object(
                'action', 'continue',
                'label', 'Looks good, proceed to summary'
              ),
              jsonb_build_object(
                'action', 'retry',
                'label', 'Retry with different parameters',
                'allows_modification', true
              ),
              jsonb_build_object(
                'action', 'abort',
                'label', 'Stop orchestration'
              )
            )
          ),
          'output_mapping',
          jsonb_build_object(
            'query_results', '$.content.deliverable.content',
            'sql', '$.content.deliverable.metadata.sql',
            'row_count', '$.content.deliverable.metadata.rowCount'
          )
        ),
        jsonb_build_object(
          'id', 'summarize-results',
          'name', 'Summarize KPIs',
          'agent', 'summarizer',
          'mode', 'BUILD',
          'depends_on', jsonb_build_array('fetch-kpi-data'),
          'input',
          jsonb_build_object(
            'userMessage',
            E'Analyze these KPI results and provide:\n- Key metrics summary\n- Trends and patterns\n- Recommendations',
            'context',
            jsonb_build_object(
              'data', '{{ steps.fetch-kpi-data.query_results }}',
              'kpis', '{{ kpi_names }}',
              'sql', '{{ steps.fetch-kpi-data.sql }}',
              'row_count', '{{ steps.fetch-kpi-data.row_count }}'
            )
          ),
          'output_mapping',
          jsonb_build_object(
            'summary', '$.content.deliverable.content',
            'summary_deliverable_id', '$.content.deliverable.id'
          )
        )
      ),
      'parameters',
      jsonb_build_array(
        jsonb_build_object(
          'name', 'kpi_names',
          'type', 'string[]',
          'required', true,
          'description', 'Names of KPIs to track'
        ),
        jsonb_build_object(
          'name', 'start_date',
          'type', 'date',
          'required', true,
          'description', 'Start date for KPI tracking'
        ),
        jsonb_build_object(
          'name', 'end_date',
          'type', 'date',
          'required', true,
          'description', 'End date for KPI tracking'
        ),
        jsonb_build_object(
          'name', 'grouping',
          'type', 'string',
          'required', false,
          'default', 'day',
          'enum', jsonb_build_array('day', 'week', 'month'),
          'description', 'Time grouping for results'
        )
      ),
      'error_handling',
      jsonb_build_object(
        'on_step_failure',
        jsonb_build_object(
          'retry_count', 2,
          'notify_human', true,
          'allow_skip', false
        )
      )
    )
  );

  INSERT INTO public.orchestration_definitions (
    owner_agent_slug,
    organization_slug,
    name,
    display_name,
    version,
    description,
    definition,
    status,
    created_by
  )
  VALUES (
    'finance-manager',
    'global',
    'kpi-tracking',
    'KPI Tracking Orchestration',
    '1.0.0',
    'Fetch KPI data with Supabase agent, then summarize results via summarizer agent.',
    definition,
    'active',
    NULL
  )
  ON CONFLICT (owner_agent_slug, organization_slug, name, version)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    definition = EXCLUDED.definition,
    status = EXCLUDED.status,
    updated_at = NOW();
END $$;

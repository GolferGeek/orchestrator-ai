-- Seed Phase 6 finance-quarterly-review orchestration definition
-- Created: 2025-10-13

DO $$
DECLARE
  definition jsonb;
BEGIN
  definition := jsonb_build_object(
    'metadata',
    jsonb_build_object(
      'name', 'finance-quarterly-review',
      'displayName', 'Finance Quarterly Review',
      'version', '1.0.0',
      'description', 'Run KPI tracking orchestration and prepare an executive finance brief.'
    ),
    'orchestration',
    jsonb_build_object(
      'steps',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'run-kpi-tracking',
          'name', 'Execute KPI Tracking Orchestration',
          'type', 'orchestration',
          'agent', 'finance-manager',
          'orchestration',
          jsonb_build_object(
            'name', 'kpi-tracking',
            'version', '1.0.0',
            'inherit_conversation', true,
            'parameters',
            jsonb_build_object(
              'kpi_names', '{{ parameters.kpi_names }}',
              'start_date', '{{ parameters.start_date }}',
              'end_date', '{{ parameters.end_date }}',
              'grouping', '{{ parameters.grouping }}'
            )
          )
        ),
        jsonb_build_object(
          'id', 'prepare-executive-brief',
          'name', 'Prepare Executive Brief',
          'agent', 'summarizer',
          'mode', 'BUILD',
          'depends_on', jsonb_build_array('run-kpi-tracking'),
          'input',
          jsonb_build_object(
            'userMessage',
            E'Create an executive-ready summary based on the KPI tracking results.\nHighlight notable trends, risks, and recommended follow-ups.',
            'context',
            jsonb_build_object(
              'childStatus', '{{ steps.run-kpi-tracking.status }}',
              'aggregatedResults', '{{ steps.run-kpi-tracking.results }}',
              'summary', '{{ steps.run-kpi-tracking.results.summarize-results.summary }}'
            )
          ),
          'output_mapping',
          jsonb_build_object(
            'executive_summary', '$.content.deliverable.content',
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
          'description', 'Names of KPIs to include'
        ),
        jsonb_build_object(
          'name', 'start_date',
          'type', 'date',
          'required', true,
          'description', 'Start date for the review window'
        ),
        jsonb_build_object(
          'name', 'end_date',
          'type', 'date',
          'required', true,
          'description', 'End date for the review window'
        ),
        jsonb_build_object(
          'name', 'grouping',
          'type', 'string',
          'required', false,
          'default', 'month',
          'enum', jsonb_build_array('day', 'week', 'month'),
          'description', 'Time grouping for KPI aggregation'
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
    'finance-quarterly-review',
    'Finance Quarterly Review',
    '1.0.0',
    'Execute KPI tracking orchestration and produce an executive finance brief.',
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

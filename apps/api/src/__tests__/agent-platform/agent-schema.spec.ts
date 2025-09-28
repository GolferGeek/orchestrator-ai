import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Agent schema validation', () => {
  const schemaDir = join(__dirname, '../../../../../schemas/agent-platform');
  const agentSchema = JSON.parse(
    readFileSync(join(schemaDir, 'agent.schema.json'), 'utf8'),
  );
  const planTemplateSchema = JSON.parse(
    readFileSync(join(schemaDir, 'plan-template.schema.json'), 'utf8'),
  );

  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(planTemplateSchema);
  const validate = ajv.compile(agentSchema);

  it('accepts a valid agent descriptor', () => {
    const sampleAgent = {
      metadata: {
        name: 'Marketing Swarm',
        slug: 'marketing_swarm',
        display_name: 'Marketing Swarm',
        description:
          'Coordinates supporting agents to produce comprehensive marketing campaigns.',
        version: '1.0.0',
        tags: ['marketing', 'orchestration'],
      },
      agent_type: 'function',
      mode_profile: 'full_cycle',
      hierarchy: {
        level: 'specialist',
        reports_to: 'marketing_manager_orchestrator',
        department: 'marketing',
      },
      capabilities: ['content_orchestration', 'multi_agent_coordination'],
      skills: [
        {
          id: 'content_campaign_creation',
          name: 'Content Campaign Creation',
          description: 'Design and coordinate multi-channel content campaigns.',
          tags: ['campaign', 'content'],
          examples: ['Create a launch campaign for our new AI assistant.'],
          input_modes: ['text/plain', 'application/json'],
          output_modes: ['text/markdown'],
        },
      ],
      execution: {
        default_mode: 'converse',
        supported_modes: ['converse', 'plan', 'build'],
        requires_plan: true,
        deliverable_types: ['campaign_brief', 'content_bundle'],
        human_checkpoints: [
          {
            id: 'approve_plan',
            label: 'Approve Plan',
            description: 'Manager signs off on generated plan before execution.',
          },
        ],
        supporting_agents: [
          {
            agent_slug: 'market_researcher',
            capabilities: ['research'],
          },
        ],
        tool_dependencies: [
          {
            tool_slug: 'notion_database_sync',
            alias: 'notion',
          },
        ],
      },
      plan_template: {
        success_criteria:
          'Deliver a multi-channel campaign brief, draft assets, and evaluation checklist.',
        phases: [
          {
            id: 'research',
            description: 'Collect requirements and analyze audience.',
            required_deliverables: ['research_summary'],
            human_checkpoints: ['approve_plan'],
          },
          {
            id: 'content_creation',
            description: 'Draft campaign collateral.',
            required_deliverables: ['content_bundle'],
          },
        ],
        fallback_strategies: ['Re-run research with updated inputs.'],
        risks: ['Insufficient product information.'],
      },
      context_files: {
        system_prompt: './context/system.md',
        plan_rubric: './context/plan-rubric.md',
      },
    };

    const valid = validate(sampleAgent);
    if (!valid) {
      console.error(validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('rejects invalid agent descriptors', () => {
    const invalidAgent = {
      metadata: { name: 'Broken Agent' },
      agent_type: 'context',
      mode_profile: 'converse_only',
      execution: {
        default_mode: 'converse',
        supported_modes: [],
      },
    };

    const valid = validate(invalidAgent);
    expect(valid).toBe(false);
    expect(validate.errors).toBeDefined();
  });
});

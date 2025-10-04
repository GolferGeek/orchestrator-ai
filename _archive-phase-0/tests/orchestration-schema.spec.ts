import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Agent orchestration schema validation', () => {
  const schemaDir = join(__dirname, '../../../../../schemas/agent-platform');
  const orchestrationSchema = JSON.parse(
    readFileSync(join(schemaDir, 'orchestration.schema.json'), 'utf8'),
  );

  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(orchestrationSchema);

  it('accepts a valid orchestration recipe', () => {
    const sampleRecipe = {
      slug: 'launch_campaign_v1',
      display_name: 'Product Launch Campaign',
      description: 'Reusable orchestration for product launches.',
      agent_slug: 'marketing_orchestrator',
      status: 'active',
      tags: ['marketing', 'launch'],
      version: '1.0.0',
      orchestration: {
        summary: 'Coordinate research, content creation, and review phases.',
        phases: [
          {
            id: 'research',
            label: 'Research',
            steps: [
              {
                id: 'gather_insights',
                action: 'Collect latest audience insights',
                agent: 'research_specialist',
                deliverables: ['insights_report'],
              },
            ],
          },
          {
            id: 'content',
            label: 'Content Development',
            steps: [
              {
                id: 'draft_assets',
                action: 'Draft campaign collateral',
                agent: 'content_creator',
                depends_on: ['gather_insights'],
                deliverables: ['campaign_draft'],
              },
            ],
          },
        ],
      },
      prompt_templates: [
        {
          name: 'plan_prompt',
          template:
            'Plan a launch for {{ product_name }} targeting {{ audience_segment }}.',
          modelProfile: 'gpt-4o-medium',
          parameters: [
            { key: 'product_name', required: true },
            { key: 'audience_segment', required: true },
            { key: 'tone', required: false, defaultValue: 'professional' },
          ],
        },
      ],
    };

    const valid = validate(sampleRecipe);
    if (!valid) {
      console.error(validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('rejects orchestration recipe missing required fields', () => {
    const invalidRecipe = {
      slug: 'incomplete',
      display_name: 'Incomplete Recipe',
      orchestration: { phases: [] },
      prompt_templates: [],
    } as any;

    const valid = validate(invalidRecipe);
    expect(valid).toBe(false);
    expect(validate.errors).toBeDefined();
  });
});

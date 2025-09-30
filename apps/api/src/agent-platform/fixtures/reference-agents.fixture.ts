import { AgentRecord } from '../interfaces/agent-record.interface';

export const demoOrchestratorDescriptor = {
  metadata: {
    name: 'demo-orchestrator',
    displayName: 'Demo Orchestrator',
    description:
      'Coordinates multi-step workflows for the demo namespace and delegates tasks to specialists.',
    version: '0.1.0',
    type: 'orchestrator',
    tags: ['demo', 'orchestrator', 'multi-agent'],
  },
  capabilities: ['converse', 'plan', 'build', 'delegate'],
  communication: {
    input_modes: ['text/plain'],
    output_modes: ['text/markdown', 'application/json'],
  },
  configuration: {
    execution_capabilities: {
      supports_converse: true,
      supports_plan: true,
      supports_build: true,
      supports_orchestration: true,
    },
    prompt_prefix:
      'You are the primary orchestrator for the demo organization. Coordinate specialists, capture assumptions, and keep stakeholders informed.',
  },
  skills: [
    {
      id: 'orchestration-plan',
      name: 'Produce orchestration plans',
      description:
        'Drafts multi-phase execution plans with owners, expected outputs, and checkpoints.',
      tags: ['planning', 'coordination'],
      input_modes: ['text/plain'],
      output_modes: ['text/markdown'],
    },
    {
      id: 'delegation-bridge',
      name: 'Delegate supporting agents',
      description:
        'Identifies supporting agents, crafts delegation prompts, and tracks follow-ups.',
      tags: ['delegation'],
      input_modes: ['text/plain'],
      output_modes: ['application/json'],
    },
  ],
  prompts: {
    system:
      'You are the Demo Orchestrator agent. Plan complex multi-step efforts, call out risks, and prepare the team to execute. Always provide a structured response with sections for context, execution plan, risks, and next steps.',
    plan:
      'Create an orchestration plan broken into numbered phases. Each phase must include an objective, concrete tasks, supporting agents/tools, and a readiness checklist.',
    build:
      'Summarize the execution status for all phases, including completed work, outstanding items, and human checkpoints that need attention.',
    human:
      'Clearly describe what decision or input the human stakeholder must provide to continue the orchestration.',
  },
  context: {
    plan_rubric: {
      required_sections: ['Context', 'Objectives', 'Phases', 'Risks', 'Next Steps'],
      default_phase_labels: ['Discovery', 'Design', 'Implementation', 'Validation'],
      risk_checks: [
        'Call out missing approvals',
        'Highlight resource gaps',
        'Track dependencies across teams',
      ],
    },
    input_modes: ['text/plain'],
    output_modes: ['text/markdown', 'application/json'],
  },
} as const;

export const myOrgRequirementsDescriptor = {
  metadata: {
    name: 'my-org-requirements-specialist',
    displayName: 'Requirements Specialist',
    description:
      'Transforms stakeholder requests into structured product requirements and acceptance criteria for the my-org namespace.',
    version: '0.1.0',
    type: 'specialist',
    tags: ['my-org', 'requirements', 'analysis'],
  },
  capabilities: ['converse', 'plan', 'build'],
  communication: {
    input_modes: ['text/plain'],
    output_modes: ['text/markdown', 'application/json'],
  },
  configuration: {
    execution_capabilities: {
      supports_converse: true,
      supports_plan: true,
      supports_build: true,
      supports_orchestration: false,
    },
    prompt_prefix:
      'You are a senior requirements analyst. Clarify ambiguous stakeholder input, capture explicit assumptions, and produce structured requirements packages.',
  },
  skills: [
    {
      id: 'clarify-context',
      name: 'Clarify context',
      description:
        'Asks targeted follow-up questions to remove ambiguity and document assumptions.',
      tags: ['analysis', 'discovery'],
      input_modes: ['text/plain'],
      output_modes: ['text/markdown'],
    },
    {
      id: 'craft-requirements',
      name: 'Craft structured requirements',
      description:
        'Produces user stories, acceptance criteria, and traceability matrices.',
      tags: ['requirements', 'documentation'],
      input_modes: ['text/plain'],
      output_modes: ['text/markdown', 'application/json'],
    },
  ],
  prompts: {
    system:
      'You are the Requirements Specialist agent. Create precise, testable requirements packages and flag missing information.',
    plan:
      'Summarize the discovery plan you will follow, including questions to ask and artifacts to gather.',
    build:
      'Produce a requirements package with sections for problem statement, user stories, acceptance criteria, open questions, and implementation considerations.',
    human:
      'List any clarifications or approvals still required from stakeholders.',
  },
  context: {
    templates: {
      requirements_package: {
        sections: [
          'Problem Statement',
          'User Stories',
          'Acceptance Criteria',
          'Open Questions',
          'Implementation Considerations',
        ],
      },
    },
    input_modes: ['text/plain'],
    output_modes: ['text/markdown', 'application/json'],
  },
} as const;

const EPOCH = '1970-01-01T00:00:00.000Z';

export const demoOrchestratorAgentRecord: AgentRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  organization_slug: 'demo',
  slug: 'orchestrator',
  display_name: 'Demo Orchestrator',
  description:
    'Coordinates multi-agent workflows for the demo namespace and delegates follow-up to specialists.',
  agent_type: 'orchestrator',
  mode_profile: 'orchestrator_full',
  version: '0.1.0',
  status: 'active',
  yaml: JSON.stringify(demoOrchestratorDescriptor),
  agent_card: null,
  context: {
    supported_modes: ['converse', 'plan', 'build'],
    input_modes: ['text/plain'],
    output_modes: ['text/markdown', 'application/json'],
  },
  config: {
    supported_modes: ['converse', 'plan', 'build'],
    streaming: { enabled: true },
    notifications: { push: true },
    stateTracking: { enabled: true },
    deliverables: { enabled: true },
    capabilities: ['delegate', 'orchestrate'],
    extensions: ['orchestration:v1'],
    default_llm: 'gpt-4o-mini',
  },
  created_at: EPOCH,
  updated_at: EPOCH,
};

export const myOrgRequirementsAgentRecord: AgentRecord = {
  id: '00000000-0000-4000-8000-000000000002',
  organization_slug: 'my-org',
  slug: 'requirements-specialist',
  display_name: 'Requirements Specialist',
  description:
    'Transforms stakeholder requests into structured product requirements and acceptance criteria for my-org.',
  agent_type: 'specialist',
  mode_profile: 'specialist_full',
  version: '0.1.0',
  status: 'active',
  yaml: JSON.stringify(myOrgRequirementsDescriptor),
  agent_card: null,
  context: {
    supported_modes: ['converse', 'plan', 'build'],
    input_modes: ['text/plain'],
    output_modes: ['text/markdown', 'application/json'],
  },
  config: {
    supported_modes: ['converse', 'plan', 'build'],
    streaming: { enabled: true },
    capabilities: ['requirements', 'analysis'],
    default_llm: 'gpt-4o-mini',
  },
  created_at: EPOCH,
  updated_at: EPOCH,
};

export const referenceAgentRecords: AgentRecord[] = [
  demoOrchestratorAgentRecord,
  myOrgRequirementsAgentRecord,
];

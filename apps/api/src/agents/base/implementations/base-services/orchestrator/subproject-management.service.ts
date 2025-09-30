/**
 * Subproject Management Service
 *
 * Handles hierarchical project coordination across different orchestrators and departments.
 * Enables complex enterprise projects to be decomposed into manageable subprojects
 * assigned to appropriate department orchestrators.
 *
 * Key capabilities:
 * - Cross-departmental subproject creation
 * - Orchestrator-to-orchestrator delegation
 * - Enterprise timeline coordination
 * - Hierarchical progress aggregation
 * - Department capacity management
 */

import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '@/llms/llm.service';
import { AgentPoolService } from '@/agent-pool/agent-pool.service';
import {
  OrchestratorInput,
  OrchestratorResponse,
  IntentDirective,
  ProjectStatus,
  PlanDefinition,
  PlanStep,
} from '@/orchestration/orchestration.types';

export interface SubprojectScope {
  department: string;
  orchestrator: string;
  estimatedDuration: string;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[]; // Other subprojects this depends on
  resources: {
    estimatedHours: number;
    requiredSkills: string[];
    humanExpertise?: string; // Specific human expert needed
  };
}

export interface SubprojectPlan {
  id: string;
  parentProjectId: string;
  name: string;
  description: string;
  scope: SubprojectScope;
  assignedOrchestrator: string;
  status: ProjectStatus;
  timeline: {
    startDate: string;
    estimatedEndDate: string;
    actualEndDate?: string;
    milestones: {
      name: string;
      date: string;
      completed: boolean;
    }[];
  };
  deliverables: {
    name: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    assignedTo?: string; // Agent or human
  }[];
  communicationPlan: {
    statusUpdates: 'daily' | 'weekly' | 'bi-weekly';
    reportingTo: string; // Parent orchestrator
    escalationCriteria: string[];
  };
}

export interface DepartmentCapacity {
  department: string;
  orchestrator: string;
  currentProjects: number;
  capacity: number; // Max concurrent projects
  averageProjectDuration: number; // In days
  specializations: string[];
  availability: {
    nextAvailableSlot: string;
    upcomingCapacity: number;
  };
}

@Injectable()
export class SubprojectManagementService {
  private readonly logger = new Logger(SubprojectManagementService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly agentPoolService: AgentPoolService,
  ) {}

  /**
   * Analyze project for subproject decomposition opportunities
   */
  async analyzeForSubprojects(
    projectDescription: string,
    input: OrchestratorInput,
  ): Promise<{
    requiresDecomposition: boolean;
    suggestedSubprojects: SubprojectScope[];
    reasoning: string;
    complexity: 'low' | 'medium' | 'high';
  }> {
    const availableOrchestrators = this.getAvailableOrchestrators();
    const departmentCapacities = await this.analyzeDepartmentCapacities();

    const analysisPrompt = `
You are an enterprise project coordinator analyzing whether a project should be decomposed into subprojects.

PROJECT DESCRIPTION:
${projectDescription}

AVAILABLE ORCHESTRATORS:
${availableOrchestrators.map((o) => `- ${o.name} (${o.department}): ${o.capabilities.join(', ')}`).join('\n')}

DEPARTMENT CAPACITIES:
${departmentCapacities.map((d) => `- ${d.department}: ${d.currentProjects}/${d.capacity} projects, next available: ${d.availability.nextAvailableSlot}`).join('\n')}

ANALYSIS CRITERIA:
1. Cross-departmental coordination required?
2. Parallel workstreams possible?
3. Specialized expertise needed from different departments?
4. Timeline longer than 2 weeks?
5. Multiple distinct deliverables?

Analyze and respond with:
1. Whether decomposition is recommended (true/false)
2. Suggested subprojects with department assignments
3. Clear reasoning for your decision
4. Overall project complexity assessment

Respond in JSON format:
{
  "requiresDecomposition": boolean,
  "suggestedSubprojects": [
    {
      "department": "string",
      "orchestrator": "string", 
      "estimatedDuration": "string",
      "priority": "low|medium|high",
      "dependencies": ["string"],
      "resources": {
        "estimatedHours": number,
        "requiredSkills": ["string"],
        "humanExpertise": "string"
      }
    }
  ],
  "reasoning": "string",
  "complexity": "low|medium|high"
}`;

    const _response = await this.llmService.generateResponse(
      analysisPrompt,
      input.userId,
      {
        temperature: 0.3,
        maxTokens: 2000,
        callerType: 'service',
        callerName: 'subproject-management-service',
        dataClassification: 'internal',
      },
    );

    const analysis = JSON.parse(response);

    return analysis;
  }

  /**
   * Create and plan subprojects from parent project
   */
  async createSubprojects(
    parentProjectId: string,
    parentPlan: PlanDefinition,
    subprojectScopes: SubprojectScope[],
    input: OrchestratorInput,
  ): Promise<SubprojectPlan[]> {
    const subprojects: SubprojectPlan[] = [];

    for (const scope of subprojectScopes) {
      const subproject = await this.createIndividualSubproject(
        parentProjectId,
        parentPlan,
        scope,
        input,
      );
      subprojects.push(subproject);
    }

    // Validate dependencies and timeline coordination
    await this.validateSubprojectCoordination(subprojects);

    return subprojects;
  }

  /**
   * Create individual subproject with detailed planning
   */
  private async createIndividualSubproject(
    parentProjectId: string,
    parentPlan: PlanDefinition,
    scope: SubprojectScope,
    input: OrchestratorInput,
  ): Promise<SubprojectPlan> {
    const subprojectId = `${parentProjectId}_${scope.department}_${Date.now()}`;

    const planningPrompt = `
You are planning a subproject within a larger enterprise initiative.

PARENT PROJECT: ${parentPlan.projectName}
PARENT DESCRIPTION: ${parentPlan.description}

SUBPROJECT SCOPE:
- Department: ${scope.department}
- Assigned Orchestrator: ${scope.orchestrator}
- Estimated Duration: ${scope.estimatedDuration}
- Priority: ${scope.priority}
- Required Skills: ${scope.resources.requiredSkills.join(', ')}
- Estimated Hours: ${scope.resources.estimatedHours}

DEPENDENCIES: ${scope.dependencies.length > 0 ? scope.dependencies.join(', ') : 'None'}

Create a detailed subproject plan with:
1. Specific name and description
2. Timeline with milestones
3. Key deliverables
4. Communication plan
5. Risk mitigation strategies

Respond in JSON format:
{
  "name": "string",
  "description": "string",
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "estimatedEndDate": "YYYY-MM-DD",
    "milestones": [
      {
        "name": "string",
        "date": "YYYY-MM-DD",
        "completed": false
      }
    ]
  },
  "deliverables": [
    {
      "name": "string",
      "description": "string",
      "status": "pending",
      "assignedTo": "string"
    }
  ],
  "communicationPlan": {
    "statusUpdates": "daily|weekly|bi-weekly",
    "reportingTo": "string",
    "escalationCriteria": ["string"]
  }
}`;

    const _response = await this.llmService.generateResponse(
      planningPrompt,
      input.userId,
      {
        temperature: 0.2,
        maxTokens: 1500,
        callerType: 'service',
        callerName: 'subproject-management-service',
        dataClassification: 'internal',
      },
    );

    const planDetails = JSON.parse(response);

    const subproject: SubprojectPlan = {
      id: subprojectId,
      parentProjectId,
      name: planDetails.name,
      description: planDetails.description,
      scope,
      assignedOrchestrator: scope.orchestrator,
      status: 'planning',
      timeline: planDetails.timeline,
      deliverables: planDetails.deliverables,
      communicationPlan: planDetails.communicationPlan,
    };

    return subproject;
  }

  /**
   * Delegate subproject to appropriate orchestrator
   */
  async delegateSubproject(
    subproject: SubprojectPlan,
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    // Prepare delegation context with subproject details
    const delegationPrompt = `
SUBPROJECT DELEGATION

You are being assigned a subproject that is part of a larger enterprise initiative.

SUBPROJECT: ${subproject.name}
DESCRIPTION: ${subproject.description}
PRIORITY: ${subproject.scope.priority}
ESTIMATED DURATION: ${subproject.scope.estimatedDuration}

TIMELINE:
- Start Date: ${subproject.timeline.startDate}
- End Date: ${subproject.timeline.estimatedEndDate}
- Key Milestones: ${subproject.timeline.milestones.map((m) => `${m.name} (${m.date})`).join(', ')}

DELIVERABLES:
${subproject.deliverables.map((d) => `- ${d.name}: ${d.description}`).join('\n')}

DEPENDENCIES: ${subproject.scope.dependencies.length > 0 ? subproject.scope.dependencies.join(', ') : 'None'}

COMMUNICATION REQUIREMENTS:
- Status Updates: ${subproject.communicationPlan.statusUpdates}
- Report To: ${subproject.communicationPlan.reportingTo}
- Escalation Criteria: ${subproject.communicationPlan.escalationCriteria.join(', ')}

Please confirm acceptance of this subproject and provide:
1. Initial timeline validation
2. Resource requirements verification
3. Any concerns or modifications needed
4. Next steps for execution

Original user request context: ${input.prompt}
`;

    try {
      // Find the target orchestrator agent
      const targetAgent = this.agentPoolService.getAgent(
        subproject.assignedOrchestrator,
      );

      if (!targetAgent) {
        throw new Error(
          `Target orchestrator ${subproject.assignedOrchestrator} not found in agent pool`,
        );
      }

      // Create delegation task for the orchestrator
      const delegationInput: OrchestratorInput = {
        ...input,
        prompt: delegationPrompt,
        projectId: subproject.id,
        metadata: {
          ...input.metadata,
          subprojectId: subproject.id,
          delegationType: 'subproject',
          parentProjectId: subproject.parentProjectId,
          priority: subproject.scope.priority,
        },
      };

      return {
        success: true,
        message: `Subproject "${subproject.name}" delegated to ${subproject.assignedOrchestrator}`,
        response: `I've delegated the subproject "${subproject.name}" to the ${subproject.scope.department} department orchestrator (${subproject.assignedOrchestrator}). They will handle the detailed planning and execution of this component.`,
        action: 'delegate_subproject',
        agentName: subproject.assignedOrchestrator,
        delegationTaskId: subproject.id,
        projectId: subproject.parentProjectId,
        metadata: {
          agentType: 'orchestrator',
          agentName: input.metadata?.agentName || 'parent_orchestrator',
          processedAt: new Date().toISOString(),
          action: 'delegate_subproject',
          subprojectId: subproject.id,
          targetOrchestrator: subproject.assignedOrchestrator,
          department: subproject.scope.department,
        },
      };
    } catch (_error) {
      throw new Error(
        `Subproject delegation failed: ${_error instanceof Error ? _error.message : 'Unknown _error'}`,
      );
    }
  }

  /**
   * Monitor and aggregate subproject progress
   */
  async aggregateSubprojectProgress(
    parentProjectId: string,
    subprojects: SubprojectPlan[],
  ): Promise<{
    overallProgress: number;
    completedSubprojects: number;
    blockedSubprojects: SubprojectPlan[];
    upcomingMilestones: {
      subprojectId: string;
      milestone: string;
      date: string;
      daysUntil: number;
    }[];
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      risks: string[];
      mitigationActions: string[];
    };
  }> {
    const now = new Date();
    const completedSubprojects = subprojects.filter(
      (sp) => sp.status === 'completed',
    ).length;
    const overallProgress = Math.round(
      (completedSubprojects / subprojects.length) * 100,
    );

    // Find blocked subprojects
    const blockedSubprojects = subprojects.filter(
      (sp) =>
        sp.status === 'paused_on_error' ||
        (sp.status === 'running' && this.isSubprojectDelayed(sp, now)),
    );

    // Get upcoming milestones (next 14 days)
    const upcomingMilestones = subprojects
      .flatMap((sp) =>
        sp.timeline.milestones
          .filter((m) => !m.completed)
          .map((m) => {
            const milestoneDate = new Date(m.date);
            const daysUntil = Math.ceil(
              (milestoneDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            return {
              subprojectId: sp.id,
              milestone: m.name,
              date: m.date,
              daysUntil,
            };
          }),
      )
      .filter((m) => m.daysUntil <= 14 && m.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // Risk assessment
    const riskAssessment = this.assessSubprojectRisks(
      subprojects,
      blockedSubprojects,
    );

    return {
      overallProgress,
      completedSubprojects,
      blockedSubprojects,
      upcomingMilestones,
      riskAssessment,
    };
  }

  /**
   * Get available orchestrators for subproject assignment
   */
  private getAvailableOrchestrators(): {
    name: string;
    department: string;
    capabilities: string[];
    currentLoad: number;
  }[] {
    const agents = this.agentPoolService.getOnlineAgents();

    return agents
      .filter((agent) => agent.type === 'orchestrator')
      .map((agent) => ({
        name: agent.id,
        department: this.extractDepartmentFromAgent(agent.id),
        capabilities: agent.capabilities || [],
        currentLoad: agent.metadata?.currentProjects || 0,
      }));
  }

  /**
   * Analyze department capacities for subproject planning
   */
  private async analyzeDepartmentCapacities(): Promise<DepartmentCapacity[]> {
    const orchestrators = this.getAvailableOrchestrators();

    return orchestrators.map((orch) => ({
      department: orch.department,
      orchestrator: orch.name,
      currentProjects: orch.currentLoad,
      capacity: 5, // Default capacity - could be configured per department
      averageProjectDuration: 14, // Default 2 weeks - could be calculated from history
      specializations: orch.capabilities,
      availability: {
        nextAvailableSlot: this.calculateNextAvailableSlot(orch.currentLoad),
        upcomingCapacity: Math.max(0, 5 - orch.currentLoad),
      },
    }));
  }

  /**
   * Validate subproject coordination and dependencies
   */
  private async validateSubprojectCoordination(
    subprojects: SubprojectPlan[],
  ): Promise<void> {
    // Check for circular dependencies
    const dependencyGraph = new Map<string, string[]>();
    subprojects.forEach((sp) => {
      dependencyGraph.set(sp.id, sp.scope.dependencies);
    });

    this.detectCircularDependencies(dependencyGraph);

    // Validate timeline coordination
    this.validateTimelineCoordination(subprojects);
  }

  /**
   * Extract department from agent ID
   */
  private extractDepartmentFromAgent(agentId: string): string {
    if (agentId.includes('marketing')) return 'marketing';
    if (agentId.includes('finance')) return 'finance';
    if (agentId.includes('hr')) return 'hr';
    if (agentId.includes('operations')) return 'operations';
    if (agentId.includes('sales')) return 'sales';
    if (agentId.includes('legal')) return 'legal';
    if (agentId.includes('engineering')) return 'engineering';
    if (agentId.includes('product')) return 'product';
    if (agentId.includes('ceo')) return 'executive';
    return 'general';
  }

  /**
   * Calculate next available slot for department
   */
  private calculateNextAvailableSlot(currentLoad: number): string {
    const now = new Date();
    const daysToAdd = currentLoad > 3 ? 7 : 0; // If overloaded, next slot is a week out
    const nextSlot = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return nextSlot.toISOString().split('T')[0] || '';
  }

  /**
   * Check if subproject is delayed
   */
  private isSubprojectDelayed(subproject: SubprojectPlan, now: Date): boolean {
    const estimatedEnd = new Date(subproject.timeline.estimatedEndDate);
    // Only consider it delayed if it's past the end date AND not completed
    // For running projects, only mark as delayed if significantly past due
    return (
      now > estimatedEnd &&
      subproject.status !== 'completed' &&
      now.getTime() - estimatedEnd.getTime() > 2 * 24 * 60 * 60 * 1000
    ); // 2 days grace period
  }

  /**
   * Assess risks across subprojects
   */
  private assessSubprojectRisks(
    subprojects: SubprojectPlan[],
    blockedSubprojects: SubprojectPlan[],
  ): {
    level: 'low' | 'medium' | 'high';
    risks: string[];
    mitigationActions: string[];
  } {
    const risks: string[] = [];
    const mitigationActions: string[] = [];

    // Check for blocked subprojects
    if (blockedSubprojects.length > 0) {
      risks.push(
        `${blockedSubprojects.length} subprojects are blocked or delayed`,
      );
      mitigationActions.push(
        'Review blocked subprojects and provide additional resources',
      );
    }

    // Check for dependency bottlenecks
    const dependencyCounts = new Map<string, number>();
    subprojects.forEach((sp) => {
      sp.scope.dependencies.forEach((dep) => {
        dependencyCounts.set(dep, (dependencyCounts.get(dep) || 0) + 1);
      });
    });

    const highDependencyProjects = Array.from(
      dependencyCounts.entries(),
    ).filter(([_, count]) => count > 2);

    if (highDependencyProjects.length > 0) {
      risks.push('Critical path dependencies identified');
      mitigationActions.push(
        'Monitor critical path projects closely and consider parallel alternatives',
      );
    }

    // Determine overall risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (blockedSubprojects.length > 2 || risks.length > 3) {
      riskLevel = 'high';
    } else if (blockedSubprojects.length > 0 || risks.length > 1) {
      riskLevel = 'medium';
    }

    return {
      level: riskLevel,
      risks,
      mitigationActions,
    };
  }

  /**
   * Detect circular dependencies in subprojects
   */
  private detectCircularDependencies(
    dependencyGraph: Map<string, string[]>,
  ): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) {
        throw new Error(
          `Circular dependency detected involving subproject: ${node}`,
        );
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const dependencies = dependencyGraph.get(node) || [];
      for (const dep of dependencies) {
        // Find the actual subproject ID that matches this dependency name
        const depNode = Array.from(dependencyGraph.keys()).find(
          (key) => key.includes(dep) || dep.includes(key.split('_')[1] || ''),
        );
        if (depNode && hasCycle(depNode)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of dependencyGraph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }
  }

  /**
   * Validate timeline coordination between subprojects
   */
  private validateTimelineCoordination(subprojects: SubprojectPlan[]): void {
    // Check for timeline conflicts with dependencies
    const projectTimelines = new Map<string, { start: Date; end: Date }>();

    subprojects.forEach((sp) => {
      projectTimelines.set(sp.id, {
        start: new Date(sp.timeline.startDate),
        end: new Date(sp.timeline.estimatedEndDate),
      });
    });

    subprojects.forEach((sp) => {
      const currentTimeline = projectTimelines.get(sp.id)!;

      sp.scope.dependencies.forEach((depId) => {
        const depTimeline = projectTimelines.get(depId);
        if (depTimeline && currentTimeline.start < depTimeline.end) {
        }
      });
    });
  }
}

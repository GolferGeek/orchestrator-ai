/**
 * Subproject Management Service Tests
 * 
 * Tests the hierarchical coordination capabilities including:
 * - Cross-departmental project decomposition
 * - Orchestrator-to-orchestrator delegation
 * - Enterprise timeline coordination
 * - Progress aggregation and risk assessment
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SubprojectManagementService, SubprojectScope, SubprojectPlan, DepartmentCapacity } from './subproject-management.service';
import { LLMService } from '@/llms/llm.service';
import { AgentPoolService } from '@/agent-pool/agent-pool.service';
import { OrchestratorInput, PlanDefinition, ProjectStatus } from '@/orchestration/orchestration.types';

describe('SubprojectManagementService', () => {
  let service: SubprojectManagementService;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockAgentPoolService: jest.Mocked<AgentPoolService>;

  const mockInput: OrchestratorInput = {
    prompt: 'Launch comprehensive product marketing campaign',
    userId: 'test-user',
    conversationId: 'test-conversation',
    sessionId: 'test-session',
    metadata: { agentName: 'ceo_orchestrator' },
  };

  const mockSubprojectScopes: SubprojectScope[] = [
    {
      department: 'marketing',
      orchestrator: 'marketing_manager_orchestrator',
      estimatedDuration: '4 weeks',
      priority: 'high',
      dependencies: [],
      resources: {
        estimatedHours: 80,
        requiredSkills: ['content_creation', 'campaign_management'],
        humanExpertise: 'Senior Content Manager',
      },
    },
    {
      department: 'finance',
      orchestrator: 'finance_orchestrator',
      estimatedDuration: '2 weeks',
      priority: 'medium',
      dependencies: ['marketing_subproject'],
      resources: {
        estimatedHours: 30,
        requiredSkills: ['budget_analysis'],
      },
    },
  ];

  const mockParentPlan: PlanDefinition = {
    projectName: 'Q4 Product Launch Campaign',
    description: 'Comprehensive go-to-market strategy for new product line',
    steps: [
      {
        stepId: 'market-research',
        stepName: 'Market Research Analysis',
        stepType: 'agent_step',
        agentName: 'market_research',
        prompt: 'Conduct comprehensive market analysis',
        dependencies: [],
      },
      {
        stepId: 'content-creation',
        stepName: 'Marketing Content Creation',
        stepType: 'agent_step',
        agentName: 'content_creator',
        prompt: 'Create marketing materials',
        dependencies: ['market-research'],
      },
    ],
    metadata: { complexity: 'high', estimatedDuration: '8 weeks' },
  };

  const mockAvailableOrchestrators = [
    {
      id: 'marketing_manager_orchestrator',
      name: 'Marketing Manager',
      type: 'orchestrator',
      capabilities: ['content_creation', 'campaign_management', 'brand_strategy'],
      status: 'online',
      metadata: { currentProjects: 2 },
    },
    {
      id: 'finance_orchestrator',
      name: 'Finance Orchestrator',
      type: 'orchestrator',
      capabilities: ['budget_analysis', 'cost_tracking', 'roi_analysis'],
      status: 'online',
      metadata: { currentProjects: 1 },
    },
    {
      id: 'product_orchestrator',
      name: 'Product Orchestrator',
      type: 'orchestrator',
      capabilities: ['product_strategy', 'feature_planning', 'roadmap_management'],
      status: 'online',
      metadata: { currentProjects: 3 },
    },
  ];

  beforeEach(async () => {
    const mockLLM = {
      generateResponse: jest.fn(),
    };

    const mockAgentPool = {
      getOnlineAgents: jest.fn(),
      getAgent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubprojectManagementService,
        { provide: LLMService, useValue: mockLLM },
        { provide: AgentPoolService, useValue: mockAgentPool },
      ],
    }).compile();

    service = module.get<SubprojectManagementService>(SubprojectManagementService);
    mockLLMService = module.get(LLMService);
    mockAgentPoolService = module.get(AgentPoolService);

    // Setup default mocks
    mockAgentPoolService.getOnlineAgents.mockReturnValue(mockAvailableOrchestrators);
    mockAgentPoolService.getAgent.mockImplementation((id: string) => 
      mockAvailableOrchestrators.find(agent => agent.id === id) || null
    );
  });

  describe('Project Decomposition Analysis', () => {
    it('should correctly identify projects requiring decomposition', async () => {
      const complexProjectDescription = `
        Launch a comprehensive product marketing campaign including:
        1. Market research and competitive analysis
        2. Brand strategy and positioning
        3. Content creation across all channels
        4. Budget planning and ROI tracking
        5. Product roadmap integration
        6. Sales enablement materials
        This is a 3-month initiative involving multiple departments
      `;

      const mockAnalysisResponse = JSON.stringify({
        requiresDecomposition: true,
        suggestedSubprojects: [
          {
            department: 'marketing',
            orchestrator: 'marketing_manager_orchestrator',
            estimatedDuration: '6 weeks',
            priority: 'high',
            dependencies: [],
            resources: {
              estimatedHours: 120,
              requiredSkills: ['content_creation', 'brand_strategy'],
              humanExpertise: 'Senior Brand Manager',
            },
          },
          {
            department: 'finance',
            orchestrator: 'finance_orchestrator',
            estimatedDuration: '2 weeks',
            priority: 'medium',
            dependencies: [],
            resources: {
              estimatedHours: 40,
              requiredSkills: ['budget_analysis', 'roi_tracking'],
            },
          },
        ],
        reasoning: 'Project involves multiple departments with specialized expertise requirements and parallel workstreams',
        complexity: 'high',
      });

      mockLLMService.generateResponse.mockResolvedValue(mockAnalysisResponse);

      const result = await service.analyzeForSubprojects(complexProjectDescription, mockInput);

      expect(result.requiresDecomposition).toBe(true);
      expect(result.suggestedSubprojects).toHaveLength(2);
      expect(result.complexity).toBe('high');
      expect(result.suggestedSubprojects[0].department).toBe('marketing');
      expect(result.suggestedSubprojects[1].department).toBe('finance');
      
      expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('AVAILABLE ORCHESTRATORS'),
        mockInput.userId,
        expect.objectContaining({ temperature: 0.3 })
      );
    });

    it('should recommend single project approach for simple tasks', async () => {
      const simpleProjectDescription = 'Create a blog post about our new product feature';

      const mockAnalysisResponse = JSON.stringify({
        requiresDecomposition: false,
        suggestedSubprojects: [],
        reasoning: 'Single task that can be completed by one agent within marketing department',
        complexity: 'low',
      });

      mockLLMService.generateResponse.mockResolvedValue(mockAnalysisResponse);

      const result = await service.analyzeForSubprojects(simpleProjectDescription, mockInput);

      expect(result.requiresDecomposition).toBe(false);
      expect(result.suggestedSubprojects).toHaveLength(0);
      expect(result.complexity).toBe('low');
    });

    it('should handle LLM service errors gracefully', async () => {
      mockLLMService.generateResponse.mockRejectedValue(new Error('LLM service unavailable'));

      await expect(
        service.analyzeForSubprojects('test project', mockInput)
      ).rejects.toThrow('Subproject analysis failed: LLM service unavailable');
    });
  });

  describe('Subproject Creation and Planning', () => {

    it('should create detailed subproject plans', async () => {
      const mockPlanResponse = JSON.stringify({
        name: 'Marketing Campaign Execution',
        description: 'Complete marketing campaign including content creation and channel management',
        timeline: {
          startDate: '2024-01-15',
          estimatedEndDate: '2024-02-12',
          milestones: [
            { name: 'Content Strategy Complete', date: '2024-01-22', completed: false },
            { name: 'Campaign Launch', date: '2024-02-01', completed: false },
          ],
        },
        deliverables: [
          {
            name: 'Campaign Content Package',
            description: 'Complete set of marketing materials',
            status: 'pending',
            assignedTo: 'content_creator',
          },
        ],
        communicationPlan: {
          statusUpdates: 'weekly',
          reportingTo: 'ceo_orchestrator',
          escalationCriteria: ['Timeline delays > 3 days', 'Budget overrun > 10%'],
        },
      });

      mockLLMService.generateResponse.mockResolvedValue(mockPlanResponse);

      const subprojects = await service.createSubprojects(
        'parent-project-123',
        mockParentPlan,
        mockSubprojectScopes,
        mockInput
      );

      expect(subprojects).toHaveLength(2);
      expect(subprojects[0].name).toBe('Marketing Campaign Execution');
      expect(subprojects[0].assignedOrchestrator).toBe('marketing_manager_orchestrator');
      expect(subprojects[0].status).toBe('planning');
      expect(subprojects[0].timeline.milestones).toHaveLength(2);
      expect(subprojects[0].deliverables).toHaveLength(1);
    });

    it('should validate subproject coordination and dependencies', async () => {
      // Mock circular dependency scenario
      const circularScopes: SubprojectScope[] = [
        {
          ...mockSubprojectScopes[0],
          dependencies: ['finance_subproject'],
        },
        {
          ...mockSubprojectScopes[1],
          dependencies: ['marketing_subproject'],
        },
      ];

      mockLLMService.generateResponse.mockResolvedValue(JSON.stringify({
        name: 'Test Subproject',
        description: 'Test',
        timeline: { startDate: '2024-01-01', estimatedEndDate: '2024-01-15', milestones: [] },
        deliverables: [],
        communicationPlan: { statusUpdates: 'weekly', reportingTo: 'parent', escalationCriteria: [] },
      }));

      await expect(
        service.createSubprojects('parent-123', mockParentPlan, circularScopes, mockInput)
      ).rejects.toThrow('Circular dependency detected');
    });
  });

  describe('Subproject Delegation', () => {
    const mockSubproject: SubprojectPlan = {
      id: 'subproject-123',
      parentProjectId: 'parent-123',
      name: 'Marketing Campaign Execution',
      description: 'Complete marketing campaign',
      scope: mockSubprojectScopes[0],
      assignedOrchestrator: 'marketing_manager_orchestrator',
      status: 'planning',
      timeline: {
        startDate: '2024-01-15',
        estimatedEndDate: '2024-02-12',
        milestones: [
          { name: 'Content Complete', date: '2024-01-30', completed: false },
        ],
      },
      deliverables: [
        {
          name: 'Campaign Materials',
          description: 'All marketing content',
          status: 'pending',
        },
      ],
      communicationPlan: {
        statusUpdates: 'weekly',
        reportingTo: 'ceo_orchestrator',
        escalationCriteria: ['Timeline delays > 3 days'],
      },
    };

    it('should successfully delegate subproject to target orchestrator', async () => {
      const result = await service.delegateSubproject(mockSubproject, mockInput);

      expect(result.success).toBe(true);
      expect(result.action).toBe('delegate_subproject');
      expect(result.agentName).toBe('marketing_manager_orchestrator');
      expect(result.delegationTaskId).toBe('subproject-123');
      expect(result.metadata?.targetOrchestrator).toBe('marketing_manager_orchestrator');
      expect(result.metadata?.department).toBe('marketing');
      
      expect(mockAgentPoolService.getAgent).toHaveBeenCalledWith('marketing_manager_orchestrator');
    });

    it('should handle missing target orchestrator', async () => {
      mockAgentPoolService.getAgent.mockReturnValue(null);

      await expect(
        service.delegateSubproject(mockSubproject, mockInput)
      ).rejects.toThrow('Target orchestrator marketing_manager_orchestrator not found in agent pool');
    });
  });

  describe('Progress Aggregation and Risk Assessment', () => {
    const mockSubprojects: SubprojectPlan[] = [
      {
        id: 'subproject-1',
        parentProjectId: 'parent-123',
        name: 'Marketing Execution',
        description: 'Marketing campaign',
        scope: mockSubprojectScopes[0],
        assignedOrchestrator: 'marketing_manager_orchestrator',
        status: 'completed',
        timeline: {
          startDate: '2024-01-01',
          estimatedEndDate: '2024-01-15',
          milestones: [
            { name: 'Content Complete', date: '2024-01-10', completed: true },
            { name: 'Campaign Launch', date: '2024-01-14', completed: true },
          ],
        },
        deliverables: [{ name: 'Content', description: 'Marketing content', status: 'completed' }],
        communicationPlan: {
          statusUpdates: 'weekly',
          reportingTo: 'parent',
          escalationCriteria: [],
        },
      },
      {
        id: 'subproject-2',
        parentProjectId: 'parent-123',
        name: 'Budget Analysis',
        description: 'Financial analysis',
        scope: mockSubprojectScopes[1],
        assignedOrchestrator: 'finance_orchestrator',
        status: 'running',
        timeline: {
          startDate: '2024-01-15',
          estimatedEndDate: '2024-01-29',
          milestones: [
            { name: 'Budget Review', date: '2024-01-20', completed: false },
            { name: 'ROI Analysis', date: '2024-01-28', completed: false },
          ],
        },
        deliverables: [{ name: 'Budget Report', description: 'Financial report', status: 'in_progress' }],
        communicationPlan: {
          statusUpdates: 'weekly',
          reportingTo: 'parent',
          escalationCriteria: [],
        },
      },
      {
        id: 'subproject-3',
        parentProjectId: 'parent-123',
        name: 'Product Strategy',
        description: 'Product planning',
        scope: {
          department: 'product',
          orchestrator: 'product_orchestrator',
          estimatedDuration: '3 weeks',
          priority: 'medium',
          dependencies: [],
          resources: { estimatedHours: 60, requiredSkills: ['strategy'] },
        },
        assignedOrchestrator: 'product_orchestrator',
        status: 'paused_on_error',
        timeline: {
          startDate: '2024-01-08',
          estimatedEndDate: '2024-01-22',
          milestones: [
            { name: 'Strategy Review', date: '2024-01-15', completed: false },
          ],
        },
        deliverables: [{ name: 'Strategy Doc', description: 'Product strategy', status: 'pending' }],
        communicationPlan: {
          statusUpdates: 'weekly',
          reportingTo: 'parent',
          escalationCriteria: [],
        },
      },
    ];

    it('should correctly aggregate subproject progress', async () => {
      // Mock current date to be 2024-01-16 to ensure only subproject-3 is considered delayed
      const mockNow = new Date('2024-01-16');
      jest.spyOn(global, 'Date').mockImplementation((() => mockNow) as any);

      const result = await service.aggregateSubprojectProgress('parent-123', mockSubprojects);

      expect(result.overallProgress).toBe(33); // 1 completed out of 3
      expect(result.completedSubprojects).toBe(1);
      expect(result.blockedSubprojects).toHaveLength(1);
      expect(result.blockedSubprojects[0].id).toBe('subproject-3');
      expect(result.upcomingMilestones.length).toBeGreaterThan(0);
      
      expect(result.riskAssessment.level).toBe('medium');
      expect(result.riskAssessment.risks).toContainEqual(
        expect.stringContaining('1 subprojects are blocked or delayed')
      );
      expect(result.riskAssessment.mitigationActions.length).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });

    it('should identify upcoming milestones within 14 days', async () => {
      // Mock current date to be 2024-01-18
      const mockNow = new Date('2024-01-18');
      jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any);

      const result = await service.aggregateSubprojectProgress('parent-123', mockSubprojects);

      const upcomingMilestones = result.upcomingMilestones;
      expect(upcomingMilestones.every(m => m.daysUntil >= 0 && m.daysUntil <= 14)).toBe(true);
      expect(upcomingMilestones).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            milestone: 'Budget Review',
            daysUntil: expect.any(Number),
          }),
        ])
      );

      jest.restoreAllMocks();
    });

    it('should assess high risk when multiple subprojects are blocked', async () => {
      const highRiskSubprojects = mockSubprojects.map(sp => ({
        ...sp,
        status: 'paused_on_error' as ProjectStatus,
      }));

      const result = await service.aggregateSubprojectProgress('parent-123', highRiskSubprojects);

      expect(result.riskAssessment.level).toBe('high');
      expect(result.blockedSubprojects).toHaveLength(3);
      expect(result.riskAssessment.risks).toContainEqual(
        expect.stringContaining('3 subprojects are blocked or delayed')
      );
    });
  });

  describe('Department Capacity Analysis', () => {
    it('should analyze available orchestrator capacities', async () => {
      const projectDescription = 'Multi-department initiative requiring coordination';
      
      const mockAnalysisResponse = JSON.stringify({
        requiresDecomposition: true,
        suggestedSubprojects: [],
        reasoning: 'Test analysis',
        complexity: 'medium',
      });

      mockLLMService.generateResponse.mockResolvedValue(mockAnalysisResponse);

      await service.analyzeForSubprojects(projectDescription, mockInput);

      // Verify that the analysis includes department capacity information
      expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('DEPARTMENT CAPACITIES'),
        expect.any(String),
        expect.any(Object)
      );

      const analysisCall = mockLLMService.generateResponse.mock.calls[0][0];
      expect(analysisCall).toContain('marketing: 2/5 projects');
      expect(analysisCall).toContain('finance: 1/5 projects');
      expect(analysisCall).toContain('product: 3/5 projects');
    });

    it('should handle orchestrators with different specializations', async () => {
      const specializedOrchestrators = [
        {
          id: 'legal_orchestrator',
          name: 'Legal Orchestrator',
          type: 'orchestrator',
          capabilities: ['contract_review', 'compliance_check', 'legal_analysis'],
          status: 'online',
          metadata: { currentProjects: 0 },
        },
        {
          id: 'hr_orchestrator',
          name: 'HR Orchestrator',
          type: 'orchestrator',
          capabilities: ['recruitment', 'policy_development', 'training_coordination'],
          status: 'online',
          metadata: { currentProjects: 1 },
        },
      ];

      mockAgentPoolService.getOnlineAgents.mockReturnValue(specializedOrchestrators);

      const mockAnalysisResponse = JSON.stringify({
        requiresDecomposition: false,
        suggestedSubprojects: [],
        reasoning: 'Specialized analysis',
        complexity: 'low',
      });

      mockLLMService.generateResponse.mockResolvedValue(mockAnalysisResponse);

      await service.analyzeForSubprojects('Legal compliance project', mockInput);

      const analysisCall = mockLLMService.generateResponse.mock.calls[0][0];
      expect(analysisCall).toContain('legal_orchestrator (legal): contract_review, compliance_check, legal_analysis');
      expect(analysisCall).toContain('hr_orchestrator (hr): recruitment, policy_development, training_coordination');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid JSON responses from LLM service', async () => {
      mockLLMService.generateResponse.mockResolvedValue('invalid json response');

      await expect(
        service.analyzeForSubprojects('test project', mockInput)
      ).rejects.toThrow('Subproject analysis failed');
    });

    it('should handle empty orchestrator pool', async () => {
      mockAgentPoolService.getOnlineAgents.mockReturnValue([]);

      const mockAnalysisResponse = JSON.stringify({
        requiresDecomposition: false,
        suggestedSubprojects: [],
        reasoning: 'No orchestrators available',
        complexity: 'low',
      });

      mockLLMService.generateResponse.mockResolvedValue(mockAnalysisResponse);

      const result = await service.analyzeForSubprojects('test project', mockInput);

      expect(result.requiresDecomposition).toBe(false);
      expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('AVAILABLE ORCHESTRATORS:\n'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should validate timeline conflicts in subproject dependencies', async () => {
      const conflictingScopes: SubprojectScope[] = [
        {
          department: 'marketing',
          orchestrator: 'marketing_manager_orchestrator',
          estimatedDuration: '2 weeks',
          priority: 'high',
          dependencies: ['finance_analysis'],
          resources: { estimatedHours: 40, requiredSkills: ['content'] },
        },
        {
          department: 'finance',
          orchestrator: 'finance_orchestrator',
          estimatedDuration: '4 weeks',
          priority: 'medium',
          dependencies: [],
          resources: { estimatedHours: 60, requiredSkills: ['analysis'] },
        },
      ];

      const mockPlanResponse = JSON.stringify({
        name: 'Test Subproject',
        description: 'Test description',
        timeline: {
          startDate: '2024-01-01', // Marketing starts before finance finishes
          estimatedEndDate: '2024-01-15',
          milestones: [],
        },
        deliverables: [],
        communicationPlan: {
          statusUpdates: 'weekly',
          reportingTo: 'parent',
          escalationCriteria: [],
        },
      });

      mockLLMService.generateResponse.mockResolvedValue(mockPlanResponse);

      // This should log warnings about timeline conflicts but not throw
      const subprojects = await service.createSubprojects(
        'parent-123',
        mockParentPlan,
        conflictingScopes,
        mockInput
      );

      expect(subprojects).toHaveLength(2);
    });
  });
});
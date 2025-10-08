import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowState,
  PhaseDefinition,
  ExecutionContext,
} from '../types/workflow-state.types';
import {
  LaunchPlan,
  HumanInputPoint,
  PhaseAgent,
} from '../types/launch-plan.types';
import {
  MarketAnalysis,
  MarketSegment,
  Competitor,
} from '../types/deliverable.types';

@Injectable()
export class MarketResearchWorkflow {
  private readonly logger = new Logger(MarketResearchWorkflow.name);

  async execute(
    context: ExecutionContext,
    launchPlan: LaunchPlan,
    messageEmitter: any,
    humanLoopService: any,
    agentFactoryService: any,
  ): Promise<MarketAnalysis> {
    const { workflowState } = context;

    messageEmitter.emit(
      '🔍 Starting market research and validation phase...',
      'progress',
      10,
    );

    try {
      // Step 1: Market size and growth analysis
      const marketSizeData = await this.analyzeMarketSize(
        launchPlan,
        messageEmitter,
        agentFactoryService,
      );

      // Step 2: Competitive analysis
      const competitorData = await this.analyzeCompetitors(
        launchPlan,
        messageEmitter,
        agentFactoryService,
      );

      // Step 3: Target audience segmentation
      const audienceData = await this.segmentTargetAudience(
        launchPlan,
        messageEmitter,
        agentFactoryService,
      );

      // Step 4: Human input for market segment selection
      const selectedSegment = await this.requestMarketSegmentSelection(
        audienceData,
        humanLoopService,
        messageEmitter,
      );

      // Step 5: Brand positioning and messaging
      const brandStrategy = await this.developBrandStrategy(
        launchPlan,
        selectedSegment,
        competitorData,
        messageEmitter,
        agentFactoryService,
      );

      // Step 6: Human validation of brand positioning
      const approvedBranding = await this.validateBrandPositioning(
        brandStrategy,
        humanLoopService,
        messageEmitter,
      );

      messageEmitter.emit(
        '✅ Market research and validation completed successfully',
        'progress',
        100,
      );

      return {
        marketSize: marketSizeData.totalMarketSize,
        growthRate: marketSizeData.growthRate,
        targetSegments: [selectedSegment],
        competitors: competitorData,
        marketTrends: marketSizeData.trends,
        opportunities: marketSizeData.opportunities,
        threats: marketSizeData.threats,
      };
    } catch (error) {

      messageEmitter.emit(
        `❌ Market research failed: ${error instanceof Error ? error.message : String(error)}`,
        'error',
        0,
      );
      throw error;
    }
  }

  private async analyzeMarketSize(
    launchPlan: LaunchPlan,
    messageEmitter: any,
    agentFactoryService: any,
  ): Promise<any> {
    messageEmitter.emit(
      '📊 Analyzing market size and growth potential...',
      'progress',
      20,
    );

    const marketResearchAgent = await agentFactoryService.createAgent(
      'research',
      'market_research_agent',
    );

    const marketAnalysis = await marketResearchAgent.executeTask(
      'analyze_market_size',
      {
        productName: launchPlan.productName,
        targetMarket: launchPlan.targetMarket,
        industry: this.extractIndustryFromPlan(launchPlan),
        geography: 'global', // Could be made configurable
        timeframe: '5_years',
      },
    );

    messageEmitter.emit('📈 Market size analysis completed', 'info', 30);

    return {
      totalMarketSize: marketAnalysis.total_addressable_market,
      growthRate: marketAnalysis.cagr,
      trends: marketAnalysis.market_trends,
      opportunities: marketAnalysis.opportunities,
      threats: marketAnalysis.threats,
    };
  }

  private async analyzeCompetitors(
    launchPlan: LaunchPlan,
    messageEmitter: any,
    agentFactoryService: any,
  ): Promise<Competitor[]> {
    messageEmitter.emit(
      '🏢 Analyzing competitive landscape...',
      'progress',
      40,
    );

    const marketResearchAgent = await agentFactoryService.createAgent(
      'research',
      'market_research_agent',
    );

    const competitorAnalysis = await marketResearchAgent.executeTask(
      'analyze_competitors',
      {
        productName: launchPlan.productName,
        targetMarket: launchPlan.targetMarket,
        maxCompetitors: 5,
        analysisDepth: 'detailed',
      },
    );

    messageEmitter.emit('🔍 Competitive analysis completed', 'info', 50);

    return competitorAnalysis.competitors.map((comp: any) => ({
      name: comp.name,
      marketShare: comp.market_share,
      strengths: comp.strengths,
      weaknesses: comp.weaknesses,
      pricing: {
        model: comp.pricing_model,
        price: comp.average_price,
        currency: 'USD',
        terms: comp.pricing_terms,
      },
      differentiators: comp.key_differentiators,
    }));
  }

  private async segmentTargetAudience(
    launchPlan: LaunchPlan,
    messageEmitter: any,
    agentFactoryService: any,
  ): Promise<MarketSegment[]> {
    messageEmitter.emit('🎯 Segmenting target audience...', 'progress', 60);

    const marketResearchAgent = await agentFactoryService.createAgent(
      'research',
      'market_research_agent',
    );

    const segmentationData = await marketResearchAgent.executeTask(
      'segment_audience',
      {
        productName: launchPlan.productName,
        targetMarket: launchPlan.targetMarket,
        segmentationCriteria: [
          'demographic',
          'psychographic',
          'behavioral',
          'geographic',
        ],
        maxSegments: 3,
      },
    );

    messageEmitter.emit('📊 Audience segmentation completed', 'info', 70);

    return segmentationData.segments.map((segment: any) => ({
      name: segment.name,
      size: segment.size,
      growthRate: segment.growth_rate,
      characteristics: segment.characteristics,
      painPoints: segment.pain_points,
      needsMatching: segment.needs_matching_score,
    }));
  }

  private async requestMarketSegmentSelection(
    segments: MarketSegment[],
    humanLoopService: any,
    messageEmitter: any,
  ): Promise<MarketSegment> {
    messageEmitter.emit(
      '⏸️ Requesting market segment selection from stakeholder...',
      'status',
      75,
    );

    const segmentOptions = segments.map(
      (s) =>
        `${s.name} (Size: ${s.size.toLocaleString()}, Growth: ${s.growthRate}%)`,
    );

    const humanInput: HumanInputPoint = {
      id: 'market_segment_selection',
      type: 'choice',
      prompt: `Based on the market research, which target segment should we prioritize for the launch of ${segments[0]}? Consider market size, growth potential, and alignment with our capabilities.`,
      options: segmentOptions,
      required: true,
      timeout: 24 * 60 * 60 * 1000, // 24 hours
      status: 'pending',
    };

    const response = await humanLoopService.requestHumanInput(
      'market_research_validation',
      humanInput.prompt,
      humanInput.options,
      humanInput.timeout,
    );

    const selectedIndex = segmentOptions.indexOf(response.response);
    const selectedSegment = segments[selectedIndex];

    if (!selectedSegment) {
      throw new Error('Invalid segment selection');
    }

    messageEmitter.emit(
      `✅ Market segment selected: ${selectedSegment.name}`,
      'info',
      80,
    );

    return selectedSegment;
  }

  private async developBrandStrategy(
    launchPlan: LaunchPlan,
    targetSegment: MarketSegment,
    competitors: Competitor[],
    messageEmitter: any,
    agentFactoryService: any,
  ): Promise<any> {
    messageEmitter.emit(
      '🎨 Developing brand strategy and positioning...',
      'progress',
      85,
    );

    const brandStrategyAgent = await agentFactoryService.createAgent(
      'marketing',
      'brand_strategy_agent',
    );

    const brandStrategy = await brandStrategyAgent.executeTask(
      'develop_brand_strategy',
      {
        productName: launchPlan.productName,
        targetSegment: targetSegment,
        competitors: competitors,
        differentiationRequirements: [
          'unique_value_prop',
          'competitive_advantage',
          'emotional_connection',
        ],
        brandPersonality: ['professional', 'innovative', 'trustworthy'],
      },
    );

    messageEmitter.emit('🏆 Brand strategy developed', 'info', 90);

    return brandStrategy;
  }

  private async validateBrandPositioning(
    brandStrategy: any,
    humanLoopService: any,
    messageEmitter: any,
  ): Promise<any> {
    messageEmitter.emit(
      '⏸️ Requesting brand positioning validation...',
      'status',
      95,
    );

    const humanInput: HumanInputPoint = {
      id: 'brand_positioning_validation',
      type: 'approval',
      prompt: `Please review the proposed brand positioning:\n\n**Value Proposition:** ${brandStrategy.value_proposition}\n\n**Key Messages:** ${brandStrategy.key_messages.join(', ')}\n\n**Competitive Advantage:** ${brandStrategy.competitive_advantage}\n\nDo you approve this brand positioning for the launch?`,
      required: true,
      timeout: 4 * 60 * 60 * 1000, // 4 hours
      status: 'pending',
    };

    const response = await humanLoopService.requestHumanInput(
      'brand_positioning_validation',
      humanInput.prompt,
      undefined,
      humanInput.timeout,
    );

    if (response.response === 'approved') {
      messageEmitter.emit('✅ Brand positioning approved', 'info', 100);
      return brandStrategy;
    } else {
      messageEmitter.emit(
        '🔄 Brand positioning requires revision',
        'warning',
        95,
      );
      // In a full implementation, this would loop back for revision
      throw new Error(
        'Brand positioning not approved - workflow paused for revision',
      );
    }
  }

  private extractIndustryFromPlan(launchPlan: LaunchPlan): string {
    // Simple industry extraction - in a real implementation this would be more sophisticated
    if (
      launchPlan.productName.toLowerCase().includes('software') ||
      launchPlan.productName.toLowerCase().includes('app')
    ) {
      return 'technology';
    }
    if (
      launchPlan.productName.toLowerCase().includes('health') ||
      launchPlan.productName.toLowerCase().includes('medical')
    ) {
      return 'healthcare';
    }
    return 'general';
  }

  getPhaseDefinition(): PhaseDefinition {
    return {
      id: 'market_research_validation',
      name: 'Market Research & Validation',
      description:
        'Comprehensive market analysis, competitive research, and target audience validation',
      estimatedDuration: 2 * 60 * 60 * 1000, // 2 hours
      dependencies: [],
      agents: [
        {
          type: 'research',
          name: 'market_research_agent',
          role: 'Market size and competitive analysis',
          required: true,
          timeout: 30 * 60 * 1000, // 30 minutes
          retryPolicy: {
            maxRetries: 3,
            backoffStrategy: 'exponential',
            baseDelay: 1000,
            maxDelay: 10000,
            retryOnErrors: ['timeout', 'network_error'],
          },
          inputMapping: {
            productName: 'launchPlan.productName',
            targetMarket: 'launchPlan.targetMarket',
          },
          outputMapping: {
            marketAnalysis: 'marketResearch.analysis',
          },
        },
        {
          type: 'marketing',
          name: 'brand_strategy_agent',
          role: 'Brand positioning and messaging strategy',
          required: true,
          timeout: 20 * 60 * 1000, // 20 minutes
          retryPolicy: {
            maxRetries: 2,
            backoffStrategy: 'linear',
            baseDelay: 2000,
            maxDelay: 8000,
            retryOnErrors: ['timeout'],
          },
          inputMapping: {
            targetSegment: 'marketResearch.selectedSegment',
            competitors: 'marketResearch.competitors',
          },
          outputMapping: {
            brandStrategy: 'brandStrategy.strategy',
          },
        },
      ],
      humanInputs: [
        {
          id: 'market_segment_selection',
          type: 'choice',
          prompt: 'Select the primary target market segment for launch',
          required: true,
          timeout: 24 * 60 * 60 * 1000, // 24 hours
          stakeholder: 'product_manager',
          fallbackAction: 'select_largest_segment',
        },
        {
          id: 'brand_positioning_validation',
          type: 'approval',
          prompt:
            'Approve the proposed brand positioning and messaging strategy',
          required: true,
          timeout: 4 * 60 * 60 * 1000, // 4 hours
          stakeholder: 'marketing_director',
          fallbackAction: 'auto_approve',
        },
      ],
      deliverables: [
        {
          id: 'market_analysis_report',
          name: 'Market Analysis Report',
          type: 'market_analysis',
          format: 'json',
          required: true,
          generatedBy: 'market_research_agent',
          template: 'market_analysis_template',
        },
        {
          id: 'brand_strategy_document',
          name: 'Brand Strategy Document',
          type: 'brand_strategy',
          format: 'json',
          required: true,
          generatedBy: 'brand_strategy_agent',
          template: 'brand_strategy_template',
        },
      ],
      parallelizable: true,
      criticalPath: true,
    };
  }
}

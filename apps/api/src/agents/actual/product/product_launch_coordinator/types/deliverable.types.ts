export interface DeliverableTemplate {
  id: string;
  name: string;
  type: DeliverableType;
  format: DeliverableFormat;
  version: string;
  description: string;
  sections: DeliverableSection[];
  metadata: DeliverableTemplateMetadata;
}

export interface DeliverableSection {
  id: string;
  name: string;
  order: number;
  required: boolean;
  contentType: 'text' | 'table' | 'chart' | 'list' | 'image' | 'mixed';
  template: string;
  dataSource: string;
  generatedBy: string;
  validationRules: ValidationRule[];
}

export interface DeliverableTemplateMetadata {
  author: string;
  createdAt: Date;
  lastUpdated: Date;
  version: string;
  tags: string[];
  estimatedGenerationTime: number;
  dependencies: string[];
  outputSize: number;
}

export enum DeliverableType {
  LAUNCH_PLAN = 'launch_plan_document',
  FINANCIAL_PROJECTIONS = 'financial_projections',
  MARKETING_MATERIALS = 'marketing_materials',
  TECHNICAL_DOCS = 'technical_documentation',
  LAUNCH_CHECKLIST = 'launch_checklist',
  STATUS_REPORT = 'status_report',
  RISK_ASSESSMENT = 'risk_assessment',
  PERFORMANCE_METRICS = 'performance_metrics',
}

export enum DeliverableFormat {
  PDF = 'pdf',
  XLSX = 'xlsx',
  JSON = 'json',
  MARKDOWN = 'markdown',
  HTML = 'html',
  DOCX = 'docx',
  CSV = 'csv',
}

export interface LaunchPlanDocument {
  executiveSummary: ExecutiveSummary;
  productOverview: ProductOverview;
  marketAnalysis: MarketAnalysis;
  technicalSpecs: TechnicalSpecs;
  goToMarketStrategy: GoToMarketStrategy;
  financialProjections: FinancialProjections;
  riskAssessment: any; // Use any for now to avoid circular dependencies
  launchTimeline: any; // Use any for now to avoid circular dependencies
  successMetrics: any; // Use any for now to avoid circular dependencies
  appendices: Appendix[];
}

export interface ExecutiveSummary {
  productName: string;
  launchDate: Date;
  targetMarket: string;
  keyFeatures: string[];
  competitiveAdvantage: string;
  financialSummary: FinancialSummary;
  successProbability: number;
  recommendation: string;
}

export interface ProductOverview {
  name: string;
  description: string;
  category: string;
  targetAudience: string;
  valueProposition: string;
  keyFeatures: Feature[];
  differentiators: string[];
  positioning: string;
}

export interface Feature {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  timeline: string;
  dependencies: string[];
}

export interface MarketAnalysis {
  marketSize: number;
  growthRate: number;
  targetSegments: MarketSegment[];
  competitors: Competitor[];
  marketTrends: string[];
  opportunities: string[];
  threats: string[];
}

export interface MarketSegment {
  name: string;
  size: number;
  growthRate: number;
  characteristics: string[];
  painPoints: string[];
  needsMatching: number;
}

export interface Competitor {
  name: string;
  marketShare: number;
  strengths: string[];
  weaknesses: string[];
  pricing: PricingInfo;
  differentiators: string[];
}

export interface PricingInfo {
  model: string;
  price: number;
  currency: string;
  terms: string;
}

export interface TechnicalSpecs {
  architecture: string;
  technologies: string[];
  requirements: TechnicalRequirement[];
  constraints: string[];
  scalability: ScalabilityInfo;
  security: SecurityInfo;
  integration: IntegrationInfo;
}

export interface TechnicalRequirement {
  category: string;
  requirement: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  effort: string;
  risks: string[];
}

export interface ScalabilityInfo {
  expectedLoad: string;
  scalingStrategy: string;
  bottlenecks: string[];
  mitigation: string[];
}

export interface SecurityInfo {
  requirements: string[];
  compliance: string[];
  risks: string[];
  mitigation: string[];
}

export interface IntegrationInfo {
  systems: string[];
  apis: string[];
  dataFlow: string[];
  dependencies: string[];
}

export interface GoToMarketStrategy {
  launchStrategy: string;
  channels: Channel[];
  campaigns: Campaign[];
  salesStrategy: SalesStrategy;
  partnerships: Partnership[];
  timeline: MarketingTimeline;
}

export interface Channel {
  name: string;
  type: 'digital' | 'traditional' | 'direct' | 'partner';
  reach: number;
  cost: number;
  effectiveness: number;
  timeline: string;
}

export interface Campaign {
  name: string;
  objective: string;
  audience: string;
  channels: string[];
  budget: number;
  timeline: string;
  kpis: string[];
}

export interface SalesStrategy {
  model: string;
  process: string[];
  training: string[];
  materials: string[];
  targets: SalesTarget[];
}

export interface SalesTarget {
  period: string;
  revenue: number;
  units: number;
  channels: string[];
}

export interface Partnership {
  partner: string;
  type: string;
  value: string;
  terms: string;
  timeline: string;
}

export interface MarketingTimeline {
  prelaunch: TimelinePhase;
  launch: TimelinePhase;
  postlaunch: TimelinePhase;
}

export interface TimelinePhase {
  duration: string;
  activities: string[];
  deliverables: string[];
  budget: number;
}

export interface FinancialProjections {
  revenue: RevenueProjection[];
  costs: CostProjection[];
  profitability: ProfitabilityAnalysis;
  roi: ROIAnalysis;
  sensitivity: SensitivityAnalysis;
  assumptions: string[];
}

export interface RevenueProjection {
  period: string;
  amount: number;
  source: string;
  confidence: number;
}

export interface CostProjection {
  period: string;
  category: string;
  amount: number;
  type: 'fixed' | 'variable';
}

export interface ProfitabilityAnalysis {
  breakeven: number;
  margin: number;
  profitability: number[];
  timeline: string;
}

export interface ROIAnalysis {
  investment: number;
  returns: number[];
  roi: number;
  payback: number;
  irr: number;
  npv: number;
}

export interface SensitivityAnalysis {
  scenarios: Scenario[];
  keyDrivers: string[];
  risks: string[];
  mitigation: string[];
}

export interface Scenario {
  name: string;
  probability: number;
  impact: number;
  revenue: number;
  costs: number;
  roi: number;
}

export interface Appendix {
  title: string;
  content: string;
  type: 'text' | 'table' | 'chart' | 'reference';
  order: number;
}

export interface FinancialSummary {
  totalInvestment: number;
  projectedRevenue: number;
  expectedROI: number;
  breakeven: number;
  profitMargin: number;
}

export interface ValidationRule {
  type: 'required' | 'format' | 'range' | 'custom';
  parameters?: any;
  errorMessage: string;
}

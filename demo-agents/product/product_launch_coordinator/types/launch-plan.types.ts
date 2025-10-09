export interface LaunchPlan {
  id: string;
  productName: string;
  launchDate: Date;
  targetMarket: string;
  status: LaunchStatus;
  phases: LaunchPhase[];
  deliverables: LaunchDeliverable[];
  timeline: LaunchTimeline;
  budget: LaunchBudget;
  stakeholders: LaunchStakeholder[];
  riskAssessment: RiskAssessment;
  successMetrics: SuccessMetrics;
  metadata: LaunchMetadata;
}

export enum LaunchStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVED = 'approved',
  LAUNCHED = 'launched',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export interface LaunchPhase {
  id: string;
  name: string;
  description: string;
  status: PhaseStatus;
  startDate: Date;
  endDate?: Date;
  estimatedDuration: number; // in milliseconds
  dependencies: string[]; // phase IDs
  agents: PhaseAgent[];
  deliverables: string[]; // deliverable IDs
  humanInputs: HumanInputPoint[];
  progress: number; // 0-100
  messages: PhaseMessage[];
}

export enum PhaseStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_FOR_HUMAN = 'waiting_for_human',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface PhaseAgent {
  agentType: string;
  agentName: string;
  role: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: any;
  error?: string;
}

export interface HumanInputPoint {
  id: string;
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  prompt: string;
  options?: string[];
  required: boolean;
  timeout: number; // milliseconds
  response?: any;
  responseTime?: Date;
  status: 'pending' | 'completed' | 'timeout' | 'cancelled';
}

export interface PhaseMessage {
  id: string;
  timestamp: Date;
  type: 'progress' | 'status' | 'info' | 'warning' | 'error';
  content: string;
  agentName?: string;
  progressPercentage?: number;
  metadata?: any;
}

export interface LaunchDeliverable {
  id: string;
  name: string;
  type: DeliverableType;
  format: DeliverableFormat;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  generatedBy: string; // agent name
  generatedAt?: Date;
  content?: any;
  filePath?: string;
  metadata?: any;
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
}

export interface LaunchTimeline {
  startDate: Date;
  targetLaunchDate: Date;
  actualLaunchDate?: Date;
  milestones: Milestone[];
  criticalPath: string[]; // phase IDs
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'pending' | 'completed' | 'overdue';
  phaseId: string;
}

export interface LaunchBudget {
  totalBudget: number;
  allocations: BudgetAllocation[];
  spent: number;
  remaining: number;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface BudgetAllocation {
  department: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  approved: boolean;
}

export interface LaunchStakeholder {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  responsibilities: string[];
  approvalAuthority: string[];
  notificationPreferences: NotificationPreference[];
}

export interface NotificationPreference {
  event: string;
  method: 'email' | 'sms' | 'slack' | 'teams';
  enabled: boolean;
}

export interface RiskAssessment {
  risks: Risk[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategy: string;
  contingencyPlans: ContingencyPlan[];
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  category: 'technical' | 'market' | 'financial' | 'operational' | 'legal';
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
  owner: string;
  status: 'identified' | 'mitigated' | 'accepted' | 'transferred';
}

export interface ContingencyPlan {
  id: string;
  triggerCondition: string;
  actions: string[];
  responsible: string;
  timeline: string;
  budget: number;
}

export interface SuccessMetrics {
  kpis: KPI[];
  targets: Target[];
  trackingMethods: TrackingMethod[];
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  unit: string;
  target: number;
  actual?: number;
  status: 'on_track' | 'at_risk' | 'off_track';
  owner: string;
}

export interface Target {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue?: number;
  deadline: Date;
  status: 'pending' | 'in_progress' | 'achieved' | 'missed';
}

export interface TrackingMethod {
  metric: string;
  method: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  responsible: string;
  tools: string[];
}

export interface LaunchMetadata {
  createdAt: Date;
  createdBy: string;
  lastUpdated: Date;
  lastUpdatedBy: string;
  version: string;
  workflowState: any;
  tags: string[];
  notes: string[];
}

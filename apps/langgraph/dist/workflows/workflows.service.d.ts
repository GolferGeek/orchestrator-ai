import { MarketingSwarmGraph, MarketingSwarmState } from './graphs/marketing-swarm.graph';
import { RequirementsWriterGraph, RequirementsWriterState } from './graphs/requirements-writer.graph';
import { MetricsAgentGraph, MetricsAgentState } from './graphs/metrics-agent.graph';
import { WorkflowRequestDto } from '../common/dto/workflow-request.dto';
export declare class WorkflowsService {
    private readonly marketingSwarmGraph;
    private readonly requirementsWriterGraph;
    private readonly metricsAgentGraph;
    constructor(marketingSwarmGraph: MarketingSwarmGraph, requirementsWriterGraph: RequirementsWriterGraph, metricsAgentGraph: MetricsAgentGraph);
    executeMarketingSwarm(request: WorkflowRequestDto): Promise<MarketingSwarmState>;
    executeRequirementsWriter(request: WorkflowRequestDto): Promise<RequirementsWriterState>;
    executeMetricsAgent(request: WorkflowRequestDto): Promise<MetricsAgentState>;
}

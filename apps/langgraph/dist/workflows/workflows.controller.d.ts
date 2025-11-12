import { WorkflowsService } from './workflows.service';
import { WorkflowRequestDto } from '../common/dto/workflow-request.dto';
import { WorkflowResponseDto } from '../common/dto/workflow-response.dto';
export declare class WorkflowsController {
    private readonly workflowsService;
    private readonly logger;
    constructor(workflowsService: WorkflowsService);
    executeMarketingSwarm(request: WorkflowRequestDto): Promise<WorkflowResponseDto>;
    executeRequirementsWriter(request: WorkflowRequestDto): Promise<WorkflowResponseDto>;
    executeMetricsAgent(request: WorkflowRequestDto): Promise<WorkflowResponseDto>;
}

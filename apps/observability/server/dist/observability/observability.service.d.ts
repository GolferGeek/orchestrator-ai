import type { HumanInTheLoopResponse } from '../types';
export declare class ObservabilityService {
    private readonly logger;
    sendResponseToAgent(wsUrl: string, response: HumanInTheLoopResponse): Promise<void>;
}

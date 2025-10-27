import { DatabaseService } from '../database/database.service';
import { ObservabilityGateway } from './observability.gateway';
import { ObservabilityService } from './observability.service';
import type { HookEvent, HumanInTheLoopResponse } from '../types';
export declare class ObservabilityController {
    private readonly databaseService;
    private readonly gateway;
    private readonly observabilityService;
    private readonly logger;
    constructor(databaseService: DatabaseService, gateway: ObservabilityGateway, observabilityService: ObservabilityService);
    getRoot(): string;
    handleHook(hookData: any): Promise<{
        success: boolean;
        id: number;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        id?: undefined;
    }>;
    createEvent(event: HookEvent): Promise<HookEvent>;
    getFilterOptions(): Promise<import("../types").FilterOptions>;
    getRecentEvents(limit?: string): Promise<HookEvent[]>;
    respondToEvent(id: string, response: HumanInTheLoopResponse): Promise<HookEvent>;
}

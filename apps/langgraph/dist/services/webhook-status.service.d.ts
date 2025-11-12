import { HttpService } from '@nestjs/axios';
export interface StatusUpdate {
    taskId: string;
    conversationId: string;
    userId: string;
    status: 'started' | 'progress' | 'completed' | 'failed';
    timestamp: string;
    step?: string;
    message?: string;
    sequence?: number;
    totalSteps?: number;
    data?: Record<string, unknown>;
    error?: string;
}
export declare class WebhookStatusService {
    private readonly httpService;
    private readonly logger;
    constructor(httpService: HttpService);
    sendStatus(webhookUrl: string, update: StatusUpdate): Promise<void>;
    sendStarted(webhookUrl: string, taskId: string, conversationId: string, userId: string, totalSteps?: number): Promise<void>;
    sendProgress(webhookUrl: string, taskId: string, conversationId: string, userId: string, step: string, sequence: number, totalSteps: number, message?: string): Promise<void>;
    sendCompleted(webhookUrl: string, taskId: string, conversationId: string, userId: string, data?: Record<string, unknown>): Promise<void>;
    sendFailed(webhookUrl: string, taskId: string, conversationId: string, userId: string, error: string): Promise<void>;
}

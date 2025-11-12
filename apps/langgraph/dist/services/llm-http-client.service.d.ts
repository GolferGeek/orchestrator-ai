import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export interface LLMCallRequest {
    provider: string;
    model: string;
    systemMessage?: string;
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
    callerName?: string;
    userId: string;
}
export interface LLMCallResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export declare class LLMHttpClientService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly llmServiceUrl;
    private readonly llmEndpoint;
    constructor(httpService: HttpService, configService: ConfigService);
    callLLM(request: LLMCallRequest): Promise<LLMCallResponse>;
}

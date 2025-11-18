import type { Engine, EngineConfig, CompletionRequest, CompletionResponse } from '../../core/src/types';
export declare class OpenAIEngine implements Engine {
    readonly id: string;
    readonly model: string;
    readonly provider: "openai";
    private apiKey;
    private baseUrl;
    private timeout;
    private maxRetries;
    constructor(model: string, config?: EngineConfig);
    complete(request: CompletionRequest): Promise<CompletionResponse>;
    private sleep;
}
export declare const createOpenAIEngine: {
    gpt4: (config?: EngineConfig) => OpenAIEngine;
    gpt4Turbo: (config?: EngineConfig) => OpenAIEngine;
    gpt4oMini: (config?: EngineConfig) => OpenAIEngine;
    gpt35Turbo: (config?: EngineConfig) => OpenAIEngine;
};

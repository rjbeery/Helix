import type { Engine, EngineConfig, CompletionRequest, CompletionResponse } from '../../core/src/types';
export declare class AnthropicEngine implements Engine {
    readonly id: string;
    readonly model: string;
    readonly provider: "anthropic";
    private apiKey;
    private baseUrl;
    private timeout;
    private maxRetries;
    constructor(model: string, config?: EngineConfig);
    complete(request: CompletionRequest): Promise<CompletionResponse>;
    private sleep;
}
export declare const createAnthropicEngine: {
    claude3Opus: (config?: EngineConfig) => AnthropicEngine;
    claude3Sonnet: (config?: EngineConfig) => AnthropicEngine;
    claude3Haiku: (config?: EngineConfig) => AnthropicEngine;
    claude35Sonnet: (config?: EngineConfig) => AnthropicEngine;
};

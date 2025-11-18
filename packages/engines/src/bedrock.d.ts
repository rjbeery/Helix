import type { Engine, EngineConfig, CompletionRequest, CompletionResponse } from '../../core/src/types';
/**
 * AWS Bedrock Engine stub
 * TODO: Implement using @aws-sdk/client-bedrock-runtime
 */
export declare class BedrockEngine implements Engine {
    readonly id: string;
    readonly model: string;
    readonly provider: "bedrock";
    private region;
    constructor(model: string, config?: EngineConfig & {
        region?: string;
    });
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}
export declare const createBedrockEngine: {
    claudeV2: (config?: EngineConfig) => BedrockEngine;
    claude3Sonnet: (config?: EngineConfig) => BedrockEngine;
    titan: (config?: EngineConfig) => BedrockEngine;
};

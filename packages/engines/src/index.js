import { createOpenAIEngine } from './openai.js';
import { createAnthropicEngine } from './anthropic.js';
import { createBedrockEngine } from './bedrock.js';
export * from './openai.js';
export * from './anthropic.js';
export * from './bedrock.js';
/**
 * Engine Registry - maps model IDs to their factory functions
 */
export const EngineRegistry = {
    // OpenAI models
    'gpt-4': createOpenAIEngine.gpt4,
    'gpt-4-turbo': createOpenAIEngine.gpt4Turbo,
    'gpt-4o-mini': createOpenAIEngine.gpt4oMini,
    'gpt-3.5-turbo': createOpenAIEngine.gpt35Turbo,
    // Anthropic models
    'claude-3-opus': createAnthropicEngine.claude3Opus,
    'claude-3-sonnet': createAnthropicEngine.claude3Sonnet,
    'claude-3-haiku': createAnthropicEngine.claude3Haiku,
    'claude-3.5-sonnet': createAnthropicEngine.claude35Sonnet,
    // Bedrock models
    'bedrock-claude-v2': createBedrockEngine.claudeV2,
    'bedrock-claude-3-sonnet': createBedrockEngine.claude3Sonnet,
    'bedrock-titan': createBedrockEngine.titan,
};
/**
 * Create an engine instance by model ID
 */
export function createEngine(modelId, config) {
    const factory = EngineRegistry[modelId];
    if (!factory) {
        throw new Error(`Unknown model: ${modelId}. Supported: ${Object.keys(EngineRegistry).join(', ')}`);
    }
    return factory(config);
}
/**
 * Get available models grouped by provider
 */
export function getAvailableModels() {
    return {
        openai: ['gpt-4', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo'],
        anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet'],
        bedrock: ['bedrock-claude-v2', 'bedrock-claude-3-sonnet', 'bedrock-titan'],
    };
}
/**
 * Calculate estimated cost in cents based on usage and model
 */
export function calculateCost(modelId, promptTokens, completionTokens) {
    // Pricing per 1M tokens (as of 2024)
    const pricing = {
        'gpt-4': { input: 3000, output: 6000 },
        'gpt-4-turbo': { input: 1000, output: 3000 },
        'gpt-4o-mini': { input: 15, output: 60 },
        'gpt-3.5-turbo': { input: 50, output: 150 },
        'claude-3-opus': { input: 1500, output: 7500 },
        'claude-3-sonnet': { input: 300, output: 1500 },
        'claude-3-haiku': { input: 25, output: 125 },
        'claude-3.5-sonnet': { input: 300, output: 1500 },
        'bedrock-claude-v2': { input: 800, output: 2400 },
        'bedrock-claude-3-sonnet': { input: 300, output: 1500 },
        'bedrock-titan': { input: 30, output: 40 },
    };
    const modelPricing = pricing[modelId];
    if (!modelPricing) {
        return 0;
    }
    const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
    const outputCost = (completionTokens / 1_000_000) * modelPricing.output;
    return Math.ceil((inputCost + outputCost)); // Convert to cents
}

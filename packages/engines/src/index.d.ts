import type { Engine, EngineConfig } from '../../core/src/types';
import { OpenAIEngine } from './openai.js';
import { AnthropicEngine } from './anthropic.js';
import { BedrockEngine } from './bedrock.js';
export * from './openai.js';
export * from './anthropic.js';
export * from './bedrock.js';
/**
 * Engine Registry - maps model IDs to their factory functions
 */
export declare const EngineRegistry: {
    readonly 'gpt-4': (config?: EngineConfig) => OpenAIEngine;
    readonly 'gpt-4-turbo': (config?: EngineConfig) => OpenAIEngine;
    readonly 'gpt-4o-mini': (config?: EngineConfig) => OpenAIEngine;
    readonly 'gpt-3.5-turbo': (config?: EngineConfig) => OpenAIEngine;
    readonly 'claude-3-opus': (config?: EngineConfig) => AnthropicEngine;
    readonly 'claude-3-sonnet': (config?: EngineConfig) => AnthropicEngine;
    readonly 'claude-3-haiku': (config?: EngineConfig) => AnthropicEngine;
    readonly 'claude-3.5-sonnet': (config?: EngineConfig) => AnthropicEngine;
    readonly 'bedrock-claude-v2': (config?: EngineConfig) => BedrockEngine;
    readonly 'bedrock-claude-3-sonnet': (config?: EngineConfig) => BedrockEngine;
    readonly 'bedrock-titan': (config?: EngineConfig) => BedrockEngine;
};
export type SupportedModel = keyof typeof EngineRegistry;
/**
 * Create an engine instance by model ID
 */
export declare function createEngine(modelId: SupportedModel, config?: EngineConfig): Engine;
/**
 * Get available models grouped by provider
 */
export declare function getAvailableModels(): {
    readonly openai: readonly ["gpt-4", "gpt-4-turbo", "gpt-4o-mini", "gpt-3.5-turbo"];
    readonly anthropic: readonly ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.5-sonnet"];
    readonly bedrock: readonly ["bedrock-claude-v2", "bedrock-claude-3-sonnet", "bedrock-titan"];
};
/**
 * Calculate estimated cost in cents based on usage and model
 */
export declare function calculateCost(modelId: SupportedModel, promptTokens: number, completionTokens: number): number;

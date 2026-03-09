import type { Engine, EngineConfig } from '../../core/src/types';
import { OpenAIEngine, createOpenAIEngine } from './openai.js';
import { AnthropicEngine, createAnthropicEngine } from './anthropic.js';
import { BedrockEngine, createBedrockEngine } from './bedrock.js';
import { GeminiEngine, createGeminiEngine } from './gemini.js';
import { GrokEngine, createGrokEngine } from './grok.js';

export * from './openai.js';
export * from './anthropic.js';
export * from './bedrock.js';
export * from './gemini.js';
export * from './grok.js';

/**
 * Engine Registry - maps model IDs to their factory functions
 */
export const EngineRegistry = {
  // OpenAI (ChatGPT)
  'gpt-4o': createOpenAIEngine.gpt4o,
  'gpt-4': createOpenAIEngine.gpt4,
  'gpt-4-turbo': createOpenAIEngine.gpt4Turbo,
  'gpt-4o-mini': createOpenAIEngine.gpt4oMini,
  'gpt-3.5-turbo': createOpenAIEngine.gpt35Turbo,

  // Anthropic Claude
  'claude-3-opus': createAnthropicEngine.claude3Opus,
  'claude-3-sonnet': createAnthropicEngine.claude3Sonnet,
  'claude-3-haiku': createAnthropicEngine.claude3Haiku,
  'claude-3.5-sonnet': createAnthropicEngine.claude35Sonnet,
  'claude-3-opus-20240229': createAnthropicEngine.claude3Opus,
  'claude-3-sonnet-20240229': createAnthropicEngine.claude3Sonnet,
  'claude-3-haiku-20240307': createAnthropicEngine.claude3Haiku,
  'claude-3-5-sonnet-20241022': createAnthropicEngine.claude35Sonnet,
  'claude-opus-4-6': createAnthropicEngine.claude4Opus,
  'claude-sonnet-4-6': createAnthropicEngine.claude4Sonnet,
  'claude-haiku-4-5-20251001': createAnthropicEngine.claude4Haiku,

  // Google Gemini
  'gemini-1.5-pro': createGeminiEngine.gemini15Pro,
  'gemini-1.5-flash': createGeminiEngine.gemini15Flash,
  'gemini-1.5-flash-8b': createGeminiEngine.gemini15Flash8B,
  'gemini-2.0-flash-exp': createGeminiEngine.gemini2Flash,

  // Grok
  'grok-2': createGrokEngine.grok2,
  'grok-2-latest': createGrokEngine.grok2Latest,

  // Bedrock
  'bedrock-claude-v2': createBedrockEngine.claudeV2,
  'bedrock-claude-3-sonnet': createBedrockEngine.claude3Sonnet,
  'bedrock-titan': createBedrockEngine.titan,
} as const;

export type SupportedModel = keyof typeof EngineRegistry;

/**
 * Create an engine instance by model ID
 */
export function createEngine(
  modelId: SupportedModel,
  config?: EngineConfig
): Engine {
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
    openai: ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'],
    grok: ['grok-2', 'grok-2-latest'],
    bedrock: ['bedrock-claude-v2', 'bedrock-claude-3-sonnet', 'bedrock-titan'],
  } as const;
}

/**
 * Calculate estimated cost in cents based on usage and model
 */
export function calculateCost(
  modelId: SupportedModel,
  promptTokens: number,
  completionTokens: number
): number {
  // Pricing per 1M tokens (as of 2024)
  const pricing: Record<SupportedModel, { input: number; output: number }> = {
    'gpt-4o': { input: 500, output: 1500 },
    'gpt-4': { input: 3000, output: 6000 },
    'gpt-4-turbo': { input: 1000, output: 3000 },
    'gpt-4o-mini': { input: 15, output: 60 },
    'gpt-3.5-turbo': { input: 50, output: 150 },

    'claude-3-opus': { input: 1500, output: 7500 },
    'claude-3-sonnet': { input: 300, output: 1500 },
    'claude-3-haiku': { input: 25, output: 125 },
    'claude-3.5-sonnet': { input: 300, output: 1500 },
    'claude-3-opus-20240229': { input: 1500, output: 7500 },
    'claude-3-sonnet-20240229': { input: 300, output: 1500 },
    'claude-3-haiku-20240307': { input: 25, output: 125 },
    'claude-3-5-sonnet-20241022': { input: 300, output: 1500 },
    'claude-opus-4-6': { input: 1500, output: 7500 },
    'claude-sonnet-4-6': { input: 300, output: 1500 },
    'claude-haiku-4-5-20251001': { input: 25, output: 125 },

    'gemini-1.5-pro': { input: 350, output: 1050 },
    'gemini-1.5-flash': { input: 7.5, output: 30 },
    'gemini-1.5-flash-8b': { input: 3.75, output: 15 },
    'gemini-2.0-flash-exp': { input: 0, output: 0 },

    'grok-2': { input: 500, output: 1500 },
    'grok-2-latest': { input: 500, output: 1500 },

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

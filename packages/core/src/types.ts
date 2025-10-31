// Core types for Helix

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionRequest {
  messages: Message[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CompletionResponse {
  text: string;
  usage?: TokenUsage;
  tool_calls?: ToolCall[];
  finish_reason?: string;
}

export interface Engine {
  id: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'bedrock';
  
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

export interface EngineConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

import type {
  Engine,
  EngineConfig,
  CompletionRequest,
  CompletionResponse,
  Message,
  ToolCall
} from '@helix/core';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: any[];
  };
  finish_reason: string;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export class OpenAIEngine implements Engine {
  public readonly id: string;
  public readonly model: string;
  public readonly provider = 'openai' as const;
  
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(model: string, config: EngineConfig = {}) {
    this.id = `openai-${model}`;
    this.model = model;
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body: OpenAICompletionRequest = {
      model: this.model,
      messages: request.messages as OpenAIMessage[],
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      stream: request.stream || false,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }

        const data: OpenAICompletionResponse = await response.json();
        const choice = data.choices[0];

        return {
          text: choice.message.content || '',
          usage: data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          } : undefined,
          tool_calls: choice.message.tool_calls as ToolCall[],
          finish_reason: choice.finish_reason,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    throw lastError || new Error('OpenAI completion failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for common models
export const createOpenAIEngine = {
  gpt4: (config?: EngineConfig) => new OpenAIEngine('gpt-4', config),
  gpt4Turbo: (config?: EngineConfig) => new OpenAIEngine('gpt-4-turbo-preview', config),
  gpt4oMini: (config?: EngineConfig) => new OpenAIEngine('gpt-4o-mini', config),
  gpt35Turbo: (config?: EngineConfig) => new OpenAIEngine('gpt-3.5-turbo', config),
};

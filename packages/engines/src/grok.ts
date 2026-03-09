import type {
  Engine,
  EngineConfig,
  CompletionRequest,
  CompletionResponse,
  ToolCall
} from '../../core/src/types';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

interface GrokCompletionRequest {
  model: string;
  messages: GrokMessage[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface GrokUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface GrokChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: any[];
  };
  finish_reason: string;
}

interface GrokCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GrokChoice[];
  usage: GrokUsage;
}

export class GrokEngine implements Engine {
  public readonly id: string;
  public readonly model: string;
  public readonly provider = 'grok' as const;

  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(model: string, config: EngineConfig = {}) {
    this.id = `grok-${model}`;
    this.model = model;
    this.apiKey = config.apiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.x.ai/v1';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      throw new Error('Grok API key is required (set GROK_API_KEY or XAI_API_KEY)');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body: GrokCompletionRequest = {
      model: this.model,
      messages: request.messages as GrokMessage[],
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
          const apiErr: any = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(`Grok API error: ${apiErr.error?.message || response.statusText}`);
        }

        const data = await response.json() as GrokCompletionResponse;
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

    throw lastError || new Error('Grok completion failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const createGrokEngine = {
  grok2: (config?: EngineConfig) => new GrokEngine('grok-2', config),
  grok2Latest: (config?: EngineConfig) => new GrokEngine('grok-2-latest', config),
};

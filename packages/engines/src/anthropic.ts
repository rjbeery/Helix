import type {
  Engine,
  EngineConfig,
  CompletionRequest,
  CompletionResponse,
  Message,
} from '../../core/src/types';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicCompletionRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  tools?: any[];
  stream?: boolean;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicContent {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
}

interface AnthropicCompletionResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContent[];
  model: string;
  stop_reason: string | null;
  usage: AnthropicUsage;
}

export class AnthropicEngine implements Engine {
  public readonly id: string;
  public readonly model: string;
  public readonly provider = 'anthropic' as const;
  
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(model: string, config: EngineConfig = {}) {
    this.id = `anthropic-${model}`;
    this.model = model;
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Anthropic requires system message separate from messages array
    let systemPrompt: string | undefined;
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    const body: AnthropicCompletionRequest = {
      model: this.model,
      messages,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      stream: request.stream || false,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const apiErr: any = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(`Anthropic API error: ${apiErr.error?.message || response.statusText}`);
        }

        const data = await response.json() as AnthropicCompletionResponse;
        
        // Extract text content
        const textContent = data.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('');

        // Extract tool calls
        const toolCalls = data.content
          .filter(c => c.type === 'tool_use')
          .map(c => ({
            id: c.id!,
            type: 'function' as const,
            function: {
              name: c.name!,
              arguments: JSON.stringify(c.input),
            },
          }));

        return {
          text: textContent,
          usage: {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
          },
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          finish_reason: data.stop_reason || undefined,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    throw lastError || new Error('Anthropic completion failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for common models
export const createAnthropicEngine = {
  claude4Opus: (config?: EngineConfig) => new AnthropicEngine('claude-4-opus-20250514', config),
  claude4Sonnet: (config?: EngineConfig) => new AnthropicEngine('claude-4-sonnet-20250514', config),
  claude4Haiku: (config?: EngineConfig) => new AnthropicEngine('claude-4-haiku-20250514', config),
};

import type {
  Engine,
  EngineConfig,
  CompletionRequest,
  CompletionResponse,
  Message,
  ToolCall
} from '../../core/src/types';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

interface GeminiCompletionRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiCandidate {
  content: {
    parts: Array<{ text?: string; functionCall?: any }>;
    role: string;
  };
  finishReason?: string;
  index: number;
}

interface GeminiCompletionResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
}

export class GeminiEngine implements Engine {
  public readonly id: string;
  public readonly model: string;
  public readonly provider = 'gemini' as const;
  
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(model: string, config: EngineConfig = {}) {
    this.id = `gemini-${model}`;
    this.model = model;
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      throw new Error('Gemini API key is required (set GEMINI_API_KEY or GOOGLE_API_KEY)');
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Gemini requires system instruction separate from content
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: msg.content }]
        };
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    const body: GeminiCompletionRequest = {
      contents,
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (request.temperature !== undefined || request.max_tokens !== undefined) {
      body.generationConfig = {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens,
      };
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const apiErr: any = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(`Gemini API error: ${apiErr.error?.message || response.statusText}`);
        }

        const data = await response.json() as GeminiCompletionResponse;
        
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No candidates returned from Gemini API');
        }

        const candidate = data.candidates[0];
        
        // Extract text content
        const textContent = candidate.content.parts
          .filter(p => p.text)
          .map(p => p.text)
          .join('');

        // Extract function calls if present
        const functionCalls = candidate.content.parts
          .filter(p => p.functionCall)
          .map((p, idx) => ({
            id: `call_${idx}`,
            type: 'function' as const,
            function: {
              name: p.functionCall!.name,
              arguments: JSON.stringify(p.functionCall!.args || {}),
            },
          }));

        return {
          text: textContent,
          usage: data.usageMetadata ? {
            prompt_tokens: data.usageMetadata.promptTokenCount,
            completion_tokens: data.usageMetadata.candidatesTokenCount,
            total_tokens: data.usageMetadata.totalTokenCount,
          } : undefined,
          tool_calls: functionCalls.length > 0 ? functionCalls : undefined,
          finish_reason: candidate.finishReason?.toLowerCase(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    throw lastError || new Error('Gemini completion failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for common Gemini models
export const createGeminiEngine = {
  gemini15Pro: (config?: EngineConfig) => new GeminiEngine('gemini-1.5-pro', config),
  gemini15Flash: (config?: EngineConfig) => new GeminiEngine('gemini-1.5-flash', config),
  gemini15Flash8B: (config?: EngineConfig) => new GeminiEngine('gemini-1.5-flash-8b', config),
  gemini2Flash: (config?: EngineConfig) => new GeminiEngine('gemini-2.0-flash-exp', config),
};

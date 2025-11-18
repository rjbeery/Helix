export class AnthropicEngine {
    id;
    model;
    provider = 'anthropic';
    apiKey;
    baseUrl;
    timeout;
    maxRetries;
    constructor(model, config = {}) {
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
    async complete(request) {
        // Anthropic requires system message separate from messages array
        let systemPrompt;
        const messages = [];
        for (const msg of request.messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            }
            else if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content,
                });
            }
        }
        const body = {
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
        let lastError = null;
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
                    const apiErr = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                    throw new Error(`Anthropic API error: ${apiErr.error?.message || response.statusText}`);
                }
                const data = await response.json();
                // Extract text content
                const textContent = data.content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('');
                // Extract tool calls
                const toolCalls = data.content
                    .filter(c => c.type === 'tool_use')
                    .map(c => ({
                    id: c.id,
                    type: 'function',
                    function: {
                        name: c.name,
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
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.maxRetries - 1) {
                    await this.sleep(Math.pow(2, attempt) * 1000);
                    continue;
                }
            }
        }
        throw lastError || new Error('Anthropic completion failed');
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Factory function for common models
export const createAnthropicEngine = {
    claude3Opus: (config) => new AnthropicEngine('claude-3-opus-20240229', config),
    claude3Sonnet: (config) => new AnthropicEngine('claude-3-sonnet-20240229', config),
    claude3Haiku: (config) => new AnthropicEngine('claude-3-haiku-20240307', config),
    claude35Sonnet: (config) => new AnthropicEngine('claude-3-5-sonnet-20241022', config),
};

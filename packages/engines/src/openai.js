export class OpenAIEngine {
    id;
    model;
    provider = 'openai';
    apiKey;
    baseUrl;
    timeout;
    maxRetries;
    constructor(model, config = {}) {
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
    async complete(request) {
        const body = {
            model: this.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            stream: request.stream || false,
        };
        if (request.tools && request.tools.length > 0) {
            body.tools = request.tools;
        }
        let lastError = null;
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
                    const apiErr = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                    throw new Error(`OpenAI API error: ${apiErr.error?.message || response.statusText}`);
                }
                const data = await response.json();
                const choice = data.choices[0];
                return {
                    text: choice.message.content || '',
                    usage: data.usage ? {
                        prompt_tokens: data.usage.prompt_tokens,
                        completion_tokens: data.usage.completion_tokens,
                        total_tokens: data.usage.total_tokens,
                    } : undefined,
                    tool_calls: choice.message.tool_calls,
                    finish_reason: choice.finish_reason,
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
        throw lastError || new Error('OpenAI completion failed');
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Factory function for common models
export const createOpenAIEngine = {
    gpt4: (config) => new OpenAIEngine('gpt-4', config),
    gpt4Turbo: (config) => new OpenAIEngine('gpt-4-turbo-preview', config),
    gpt4oMini: (config) => new OpenAIEngine('gpt-4o-mini', config),
    gpt35Turbo: (config) => new OpenAIEngine('gpt-3.5-turbo', config),
};

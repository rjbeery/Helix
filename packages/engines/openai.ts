import type { Engine, Message } from '../core/types'

export class OpenAIEngine implements Engine {
  id = 'openai'
  constructor(public model: string = 'gpt-5') {}

  async complete(input: { messages: Message[]; tools?: any[]; temperature?: number; max_tokens?: number }) {
    // TODO: wire to OpenAI SDK
    return { text: '[openai stub]', usage: { prompt_tokens: 0, completion_tokens: 0 }, tool_calls: [] }
  }
}

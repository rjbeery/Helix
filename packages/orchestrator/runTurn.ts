import type { Message } from '../core/types'
import type { Personality } from '../core/types'

export interface RunTurnOptions {
  engine: { complete: (args: any)=>Promise<any> }
  personality: Personality
  messages: Message[]
  tools?: any[]
  overrides?: { temperature?: number; max_tokens?: number }
  ragContext?: string  // Retrieved context to inject before user message
}

export async function runTurn(opts: RunTurnOptions) {
  const sys: Message = { role: 'system', content: opts.personality.system }
  const temperature = opts.overrides?.temperature ?? opts.personality.defaults?.temperature
  const max_tokens  = opts.overrides?.max_tokens  ?? opts.personality.defaults?.max_tokens
  const tools = (opts.tools ?? []).filter(t => !opts.personality.toolWhitelist || opts.personality.toolWhitelist.includes(t.name))
  
  // Inject RAG context if provided
  let messagesWithContext = opts.messages;
  if (opts.ragContext) {
    const lastUserMsgIndex = [...opts.messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserMsgIndex !== -1) {
      const actualIndex = opts.messages.length - 1 - lastUserMsgIndex;
      messagesWithContext = opts.messages.map((msg, idx) => {
        if (idx === actualIndex) {
          return {
            role: 'user' as const,
            content: `Context from knowledge base:\n${opts.ragContext}\n\nUser question: ${msg.content}`
          };
        }
        return msg;
      });
    }
  }
  
  return opts.engine.complete({ messages: [sys, ...messagesWithContext], tools, temperature, max_tokens })
}

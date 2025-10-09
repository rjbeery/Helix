import type { Message } from '../core/types'
import type { Personality } from '../core/types'

export async function runTurn(opts: {
  engine: { complete: (args: any)=>Promise<any> }
  personality: Personality
  messages: Message[]
  tools?: any[]
  overrides?: { temperature?: number; max_tokens?: number }
}) {
  const sys: Message = { role: 'system', content: opts.personality.system }
  const temperature = opts.overrides?.temperature ?? opts.personality.defaults?.temperature
  const max_tokens  = opts.overrides?.max_tokens  ?? opts.personality.defaults?.max_tokens
  const tools = (opts.tools ?? []).filter(t => !opts.personality.toolWhitelist || opts.personality.toolWhitelist.includes(t.name))
  return opts.engine.complete({ messages: [sys, ...opts.messages], tools, temperature, max_tokens })
}

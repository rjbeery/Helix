export type Role = 'system'|'user'|'assistant'|'tool'

export type Message = {
  role: Role
  content: string
}

export type Personality = {
  id: string
  label: string
  avatar: string
  system: string
  defaults?: { temperature?: number; max_tokens?: number }
  toolWhitelist?: string[]
}

export interface Engine {
  id: string
  model: string
  complete(input: {
    messages: Message[]
    tools?: any[]
    temperature?: number
    max_tokens?: number
  }): Promise<{ text: string; usage?: any; tool_calls?: any[] }>
}

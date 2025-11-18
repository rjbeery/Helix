declare module '@helix/core' {
  export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
  export interface Message {
    role: MessageRole;
    content: string;
    name?: string;
    tool_call_id?: string;
  }
}

declare module '@helix/engines' {
  export function createEngine(modelId: string, config?: any): any;
  export function calculateCost(modelId: string, promptTokens: number, completionTokens: number): number;
}

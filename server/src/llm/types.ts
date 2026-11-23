export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

export type ToolCall = {
  id: string
  name: string
  arguments: unknown
}

export type ToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type LLMResponse = {
  content: string
  toolCalls: ToolCall[]
}

export interface LLMClient {
  chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse>
}

export function parseArguments(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return {}
    }
  }
  if (value && typeof value === 'object') return value
  return {}
}

import type { ChatMessage, LLMClient, ToolDefinition } from './types.js'
import type { UiAction } from './tools.js'

const TOOL_LIMIT = 5

export async function runAssistant(options: {
  client: LLMClient
  system: string
  message: string
  history: { role: 'user' | 'assistant'; content: string }[]
  tools: ToolDefinition[]
  execute: (name: string, args: unknown) => Promise<unknown>
  log?: (line: string) => void
  getAction?: () => UiAction | undefined
}): Promise<{ answer: string; action?: UiAction }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: options.system },
    ...options.history.slice(-40).map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: options.message },
  ]

  for (let round = 0; round < TOOL_LIMIT; round += 1) {
    const response = await options.client.chat(messages, options.tools)
    if (response.toolCalls.length === 0) {
      return {
        answer: response.content.trim() || 'I could not find an answer in the archive.',
        action: options.getAction?.(),
      }
    }
    messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls })
    for (const call of response.toolCalls) {
      options.log?.(`[assistant] ${call.name} ${JSON.stringify(call.arguments)}`)
      const result = await options.execute(call.name, call.arguments)
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(result),
      })
    }
  }

  return {
    answer: 'I reached the limit of 5 tool calls for this question. Ask something narrower.',
    action: options.getAction?.(),
  }
}

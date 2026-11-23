import { parseArguments, type LLMResponse } from './types.js'

export function parseOpenAIResponse(payload: unknown): LLMResponse {
  const message = (payload as { choices?: { message?: { content?: unknown; tool_calls?: unknown[] } }[] })
    ?.choices?.[0]?.message
  if (!message) throw new Error('OpenAI response did not include a message')
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : []
  return {
    content: typeof message.content === 'string' ? message.content : '',
    toolCalls: calls.flatMap((call, index) => {
      const item = call as { id?: unknown; function?: { name?: unknown; arguments?: unknown } }
      const name = typeof item.function?.name === 'string' ? item.function.name : ''
      if (!name) return []
      return [{
        id: typeof item.id === 'string' ? item.id : `call_${index}`,
        name,
        arguments: parseArguments(item.function?.arguments),
      }]
    }),
  }
}

export function parseAnthropicResponse(payload: unknown): LLMResponse {
  const content = (payload as { content?: unknown[] })?.content
  if (!Array.isArray(content)) throw new Error('Anthropic response did not include content')
  const text: string[] = []
  const toolCalls: LLMResponse['toolCalls'] = []
  for (const block of content) {
    const item = block as { type?: string; text?: string; id?: string; name?: string; input?: unknown }
    if (item.type === 'text' && typeof item.text === 'string') text.push(item.text)
    if (item.type === 'tool_use' && typeof item.name === 'string') {
      toolCalls.push({
        id: item.id || `tool_${toolCalls.length}`,
        name: item.name,
        arguments: item.input ?? {},
      })
    }
  }
  return { content: text.join('\n').trim(), toolCalls }
}

export function parseOllamaResponse(payload: unknown): LLMResponse {
  const message = (payload as { message?: { content?: unknown; tool_calls?: unknown[] } })?.message
  if (!message) throw new Error('Ollama response did not include a message')
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : []
  return {
    content: typeof message.content === 'string' ? message.content : '',
    toolCalls: calls.flatMap((call, index) => {
      const item = call as { function?: { name?: unknown; arguments?: unknown } }
      const name = typeof item.function?.name === 'string' ? item.function.name : ''
      if (!name) return []
      return [{
        id: `ollama_${index}`,
        name,
        arguments: parseArguments(item.function?.arguments),
      }]
    }),
  }
}

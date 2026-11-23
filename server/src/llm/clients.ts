import {
  parseAnthropicResponse,
  parseOllamaResponse,
  parseOpenAIResponse,
} from './parse.js'
import type { ChatMessage, LLMClient, LLMResponse, ToolDefinition } from './types.js'

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 400)}`)
  }
  return text ? JSON.parse(text) as unknown : {}
}

function openAIMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content }
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
        })),
      }
    }
    return { role: message.role, content: message.content }
  })
}

function anthropicPayload(messages: ChatMessage[], tools: ToolDefinition[]) {
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n')
  const converted: { role: string; content: unknown }[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    if (message.role === 'user') {
      converted.push({ role: 'user', content: message.content })
    } else if (message.role === 'assistant') {
      const content: unknown[] = []
      if (message.content) content.push({ type: 'text', text: message.content })
      for (const call of message.toolCalls ?? []) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments ?? {} })
      }
      if (content.length === 0) content.push({ type: 'text', text: '' })
      converted.push({ role: 'assistant', content })
    } else {
      const block = { type: 'tool_result', tool_use_id: message.toolCallId, content: message.content }
      const previous = converted.at(-1)
      if (previous?.role === 'user' && Array.isArray(previous.content)) previous.content.push(block)
      else converted.push({ role: 'user', content: [block] })
    }
  }
  return {
    system,
    messages: converted,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    })),
  }
}

function ollamaMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return { role: 'tool', content: message.content, tool_name: message.name }
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          type: 'function',
          function: { name: call.name, arguments: call.arguments ?? {} },
        })),
      }
    }
    return { role: message.role, content: message.content }
  })
}

function openAITools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

export class OpenAIClient implements LLMClient {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const payload = await postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: openAIMessages(messages),
        tools: tools.length ? openAITools(tools) : undefined,
      },
    )
    return parseOpenAIResponse(payload)
  }
}

export class AnthropicClient implements LLMClient {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const converted = anthropicPayload(messages, tools)
    const payload = await postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      {
        model: this.model,
        max_tokens: 1024,
        system: converted.system,
        messages: converted.messages,
        tools: converted.tools.length ? converted.tools : undefined,
      },
    )
    return parseAnthropicResponse(payload)
  }
}

export class OllamaClient implements LLMClient {
  constructor(private readonly baseUrl: string, private readonly model: string) {}

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const root = this.baseUrl.replace(/\/$/, '')
    const payload = await postJson(`${root}/api/chat`, {}, {
      model: this.model,
      messages: ollamaMessages(messages),
      tools: tools.length ? openAITools(tools) : undefined,
      stream: false,
    })
    return parseOllamaResponse(payload)
  }
}

export function createLLMClient(env: NodeJS.ProcessEnv): LLMClient {
  const provider = (env.LLM_PROVIDER || 'ollama').toLowerCase()
  if (provider === 'ollama') {
    return new OllamaClient(env.OLLAMA_URL || 'http://127.0.0.1:11434', env.LLM_MODEL || 'llama3.2')
  }
  if (provider === 'openai') {
    if (!env.LLM_API_KEY) throw new Error('LLM_API_KEY is not set')
    return new OpenAIClient(env.LLM_API_KEY, env.LLM_MODEL || 'gpt-4o-mini')
  }
  if (provider === 'anthropic') {
    if (!env.LLM_API_KEY) throw new Error('LLM_API_KEY is not set')
    return new AnthropicClient(env.LLM_API_KEY, env.LLM_MODEL || 'claude-sonnet-4-5')
  }
  throw new Error(`Unknown LLM_PROVIDER "${provider}"`)
}

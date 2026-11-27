import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { runAssistant } from '../src/llm/loop.js'
import { parseAnthropicResponse, parseOllamaResponse, parseOpenAIResponse } from '../src/llm/parse.js'
import { systemPrompt } from '../src/llm/prompt.js'
import { answerForPlayback, executeTool, messageAsksToPlay, playQuery, type ToolContext, type UiAction } from '../src/llm/tools.js'
import type { LLMClient } from '../src/llm/types.js'

describe('response parsers', () => {
  it('reads an OpenAI tool call', () => {
    const parsed = parseOpenAIResponse({
      choices: [{
        message: {
          content: '',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'get_chart', arguments: '{"genre":"soul","year":1972}' },
          }],
        },
      }],
    })
    expect(parsed.toolCalls[0]).toMatchObject({ id: 'call_1', name: 'get_chart', arguments: { genre: 'soul', year: 1972 } })
  })

  it('reads an Anthropic tool call', () => {
    const parsed = parseAnthropicResponse({
      content: [
        { type: 'text', text: 'Looking that up.' },
        { type: 'tool_use', id: 'toolu_1', name: 'coverage', input: { genre: 'jazz' } },
      ],
    })
    expect(parsed.content).toBe('Looking that up.')
    expect(parsed.toolCalls[0]?.arguments).toEqual({ genre: 'jazz' })
  })

  it('reads an Ollama tool call with object arguments', () => {
    const parsed = parseOllamaResponse({
      message: {
        content: '',
        tool_calls: [{ function: { name: 'artist_history', arguments: { artist_name: 'Mock Artist A' } } }],
      },
    })
    expect(parsed.toolCalls[0]?.name).toBe('artist_history')
  })
})

describe('playback requests', () => {
  const played: UiAction = {
    type: 'playSong',
    songId: 446,
    title: 'Oh Girl',
    artist: 'The Chi-Lites',
    videoId: 'LwjsVD23Z3E',
    year: 1972,
  }

  it('treats a title or a play request as playback, and leaves chart questions alone', () => {
    expect(messageAsksToPlay('Oh Girl')).toBe(true)
    expect(messageAsksToPlay('Play Oh Girl')).toBe(true)
    expect(messageAsksToPlay('Who sang Oh Girl?')).toBe(false)
    expect(messageAsksToPlay('which charts are empty')).toBe(false)
    expect(playQuery('Play Oh Girl')).toBe('Oh Girl')
    expect(playQuery('play that')).toBeNull()
    expect(playQuery('Who sang Oh Girl?')).toBeNull()
    expect(messageAsksToPlay('Make a random soul playlist')).toBe(false)
    expect(playQuery('Play a jazz playlist')).toBeNull()
  })

  it('replaces a false missing-recording answer when the archive can play the song', () => {
    expect(answerForPlayback('There is no recording to play.', played, false)).toBe(
      'Playing "Oh Girl" by The Chi-Lites from 1972.',
    )
  })
})

describe('system prompt', () => {
  it('lists genres, the year span, and the rule against guessing', () => {
    const prompt = systemPrompt([{ slug: 'soul', name: 'Soul' }, { slug: 'rnb', name: 'R&B' }], 2026)
    expect(prompt).toContain('soul')
    expect(prompt).toContain('1880')
    expect(prompt).toContain('2026')
    expect(prompt).toContain('playSong')
    expect(prompt).toContain('random_playlist')
    expect(prompt).toMatch(/Never invent/)
  })
})

describe('tool arguments', () => {
  it('rejects bad arguments before touching the database', async () => {
    const db = new Proxy({}, { get() { throw new Error('db touched') } }) as PrismaClient
    const ctx: ToolContext = { lastSearch: null }
    const result = await executeTool(db, 'get_chart', { genre: 'soul', year: 1800 }, ctx)
    expect(result).toMatchObject({ error: expect.stringMatching(/1880/) })
  })

  it('rejects an unknown tool', async () => {
    const db = new Proxy({}, { get() { throw new Error('db touched') } }) as PrismaClient
    const result = await executeTool(db, 'drop_table', {}, { lastSearch: null })
    expect(result).toMatchObject({ error: expect.stringMatching(/Unknown tool/) })
  })

  it('refuses a playlist write when no writer is configured', async () => {
    const db = new Proxy({}, { get() { throw new Error('db touched') } }) as PrismaClient
    const result = await executeTool(db, 'create_playlist', { name: 'Night' }, { lastSearch: null })
    expect(result).toMatchObject({ error: expect.stringMatching(/not available/) })
  })

  it('rejects playSong without a song id before touching the database', async () => {
    const db = new Proxy({}, { get() { throw new Error('db touched') } }) as PrismaClient
    const result = await executeTool(db, 'set_ui_action', { type: 'playSong' }, { lastSearch: null })
    expect(result).toMatchObject({ error: expect.stringMatching(/songId/) })
  })

  it('plays a song the archive actually has', async () => {
    const db = {
      song: {
        findUnique: async () => ({
          id: 7,
          title: 'Superstition',
          featuredArtists: null,
          releaseYear: 1972,
          youtubeVideoId: 'abc123def45',
          primaryArtistId: 3,
          primaryArtist: { id: 3, name: 'Stevie Wonder' },
        }),
      },
      chartEntry: {
        findMany: async () => [{
          rank: 1,
          song: { id: 7, title: 'Superstition', releaseYear: 1972 },
          chart: {
            id: 9,
            year: 1972,
            isOfficial: true,
            sourceName: 'Mock',
            genre: { slug: 'soul', name: 'Soul' },
          },
        }],
      },
    } as unknown as PrismaClient
    const ctx: ToolContext = { lastSearch: null }
    const result = await executeTool(db, 'set_ui_action', { type: 'playSong', songId: '7' }, ctx)
    expect(result).toMatchObject({ ok: true, hasRecording: true })
    expect(ctx.action).toEqual({
      type: 'playSong',
      songId: 7,
      title: 'Superstition',
      artist: 'Stevie Wonder',
      videoId: 'abc123def45',
      genre: 'soul',
      year: 1972,
      rank: 1,
    })
  })

  it('does not invent a recording for an unknown song', async () => {
    const db = {
      song: { findUnique: async () => null },
      chartEntry: { findMany: async () => { throw new Error('should not list entries') } },
    } as unknown as PrismaClient
    const result = await executeTool(db, 'set_ui_action', { type: 'playSong', songId: 99 }, { lastSearch: null })
    expect(result).toEqual({ error: 'No song with id 99' })
  })
})

describe('tool loop', () => {
  it('stops after 5 rounds of tool calls', async () => {
    const calls: string[] = []
    let rounds = 0
    const client: LLMClient = {
      async chat(_messages, tools) {
        rounds += 1
        if (tools.length === 0) return { content: 'final', toolCalls: [] }
        return {
          content: '',
          toolCalls: [{ id: `c${rounds}`, name: 'get_chart', arguments: { genre: 'soul', year: 1972 } }],
        }
      },
    }
    const result = await runAssistant({
      client,
      system: 'sys',
      message: 'Show soul in 1972',
      history: [],
      tools: [{ name: 'get_chart', description: 'chart', parameters: { type: 'object' } }],
      execute: async (name) => {
        calls.push(name)
        return { chart: null }
      },
    })
    expect(calls).toHaveLength(5)
    expect(rounds).toBe(5)
    expect(result.answer).toMatch(/limit of 5/)
  })

  it('returns the model answer and the recorded action', async () => {
    const ctx: ToolContext = { lastSearch: null }
    const client: LLMClient = {
      async chat(messages) {
        const toolCount = messages.filter((message) => message.role === 'tool').length
        if (toolCount === 0) {
          return {
            content: '',
            toolCalls: [{ id: 'a1', name: 'set_ui_action', arguments: { type: 'scrollToRank', rank: 12 } }],
          }
        }
        return { content: 'Mock Song 12 is rank 12 on the mock list.', toolCalls: [] }
      },
    }
    const result = await runAssistant({
      client,
      system: 'sys',
      message: 'Where is rank 12?',
      history: [],
      tools: [],
      getAction: () => ctx.action,
      execute: async (name, args) => {
        if (name === 'set_ui_action') {
          const action = args as { type: 'scrollToRank'; rank: number }
          ctx.action = action
        }
        return { ok: true }
      },
    })
    expect(result.answer).toMatch(/Mock Song 12/)
    expect(result.action).toEqual({ type: 'scrollToRank', rank: 12 })
  })
})

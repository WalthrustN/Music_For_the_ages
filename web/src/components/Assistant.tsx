import { useMutation } from '@tanstack/react-query'
import { useState, type RefObject } from 'react'
import { api } from '../api'
import { useSpeech } from '../hooks/useSpeech'
import type { ChatTurn, SearchHit, UiAction } from '../types'

export type AssistantHandle = {
  toggleMic: () => void
}

export function Assistant({
  handleRef,
  onAction,
  onPick,
}: {
  handleRef: RefObject<AssistantHandle | null>
  onAction: (action: UiAction) => void
  onPick: (hit: SearchHit) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatTurn[]>([])

  const send = useMutation({
    mutationFn: (text: string) => api.assistant(text, messages),
    onSuccess: (result) => {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant' as const,
          content: result.answer,
          results: result.action?.type === 'showResults' ? result.action.results : undefined,
        },
      ].slice(-40))
      if (result.action) onAction(result.action)
    },
  })

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || send.isPending) return
    setDraft('')
    setOpen(true)
    setMessages((current) => [...current, { role: 'user' as const, content: trimmed }].slice(-40))
    send.mutate(trimmed)
  }

  const speech = useSpeech((text) => {
    setDraft(text)
    setOpen(true)
    submit(text)
  })

  handleRef.current = { toggleMic: () => { setOpen(true); speech.toggle() } }

  const listening = speech.status === 'listening'

  return (
    <div className="fixed right-3 bottom-3 z-30 flex w-[min(100%-1.5rem,24rem)] flex-col items-end gap-2 sm:right-5 sm:bottom-5">
      {open ? (
        <section className="flex max-h-[min(32rem,70vh)] w-full flex-col rounded-3xl border border-white/15 bg-neutral-950/90 shadow-2xl backdrop-blur-xl">
          <header className="flex items-center justify-between px-4 py-3">
            <h2 className="font-serif text-xl">Archivist</h2>
            <button type="button" className="text-sm text-stone-300" onClick={() => setOpen(false)} aria-label="Collapse chat">
              Hide
            </button>
          </header>
          <div className="scroll-thin flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto px-4" aria-live="polite">
            {messages.length === 0 ? (
              <p className="text-sm text-stone-300">Ask about a year, a song, or which charts are still empty. Answers come only from the archive.</p>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'self-end text-right' : 'self-start'}>
                <p className={`inline-block rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'bg-amber-100 text-neutral-950' : 'bg-white/10 text-ivory'}`}>
                  {message.content}
                </p>
                {message.results ? (
                  <ul className="mt-2 space-y-1">
                    {message.results.map((hit) => (
                      <li key={`${hit.songId}-${hit.year}-${hit.genreSlug}-${hit.rank}`}>
                        <button
                          type="button"
                          className="w-full rounded-xl px-2 py-1 text-left text-sm hover:bg-white/10"
                          onClick={() => onPick(hit)}
                        >
                          #{hit.rank} {hit.title} · {hit.genreName} {hit.year}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            {send.isPending ? <p className="text-sm text-stone-400">Looking through the archive…</p> : null}
            {send.isError ? <p className="text-sm text-rose-200" role="alert">{(send.error as Error).message}</p> : null}
          </div>
          <form
            className="flex gap-2 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              submit(draft)
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">Message the archivist</label>
            <input
              id="assistant-input"
              value={speech.interim || draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={listening ? 'Listening…' : 'Ask about a chart'}
              className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-full bg-amber-100 px-3 py-2 text-sm text-neutral-950" disabled={send.isPending}>
              Send
            </button>
          </form>
          {speech.error ? <p className="px-4 pb-3 text-sm text-rose-200" role="alert">{speech.error}</p> : null}
        </section>
      ) : null}
      <button
        type="button"
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Start voice input'}
        onClick={() => {
          setOpen(true)
          speech.toggle()
        }}
        className={`grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-neutral-950 shadow-lg ${listening ? 'motion-safe:animate-pulse ring-4 ring-amber-200/70' : ''}`}
      >
        <span aria-hidden="true" className="text-xl">●</span>
      </button>
    </div>
  )
}

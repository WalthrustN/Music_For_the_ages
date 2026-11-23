import { useEffect, useRef, useState } from 'react'

type SpeechStatus = 'idle' | 'listening' | 'transcribing'

type SpeechCtor = new () => {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
  }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function recognitionCtor(): SpeechCtor | null {
  const candidate = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
}

export function useSpeech(onFinal: (text: string) => void) {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<InstanceType<SpeechCtor> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  useEffect(() => () => {
    recognitionRef.current?.stop()
    recorderRef.current?.stop()
  }, [])

  async function startRecorder() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      setStatus('transcribing')
      setInterim('')
      try {
        const form = new FormData()
        form.append('file', new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), 'speech.webm')
        const response = await fetch('/api/transcribe', { method: 'POST', body: form })
        const body = await response.json().catch(() => ({})) as { error?: string; text?: string }
        if (!response.ok) {
          setError(body.error || 'Transcription failed')
        } else if (body.text?.trim()) {
          onFinalRef.current(body.text.trim())
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Transcription failed')
      } finally {
        setStatus('idle')
      }
    }
    recorderRef.current = recorder
    recorder.start()
    setStatus('listening')
    setError(null)
  }

  function startNative(Ctor: SpeechCtor) {
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      let finalText = ''
      let live = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += transcript
        else live += transcript
      }
      setInterim(live)
      if (finalText.trim()) {
        setInterim('')
        onFinalRef.current(finalText.trim())
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        setError('Microphone permission was denied.')
        setStatus('idle')
        return
      }
      setError(null)
      recognition.stop()
      void startRecorder().catch(() => {
        setError('Voice input is unavailable in this browser.')
        setStatus('idle')
      })
    }
    recognition.onend = () => {
      if (recorderRef.current?.state === 'recording') return
      setStatus('idle')
      setInterim('')
    }
    recognitionRef.current = recognition
    recognition.start()
    setStatus('listening')
    setError(null)
  }

  async function start() {
    setError(null)
    const Ctor = recognitionCtor()
    if (Ctor) {
      startNative(Ctor)
      return
    }
    try {
      await startRecorder()
    } catch {
      setError('Microphone permission was denied.')
      setStatus('idle')
    }
  }

  function stop() {
    recognitionRef.current?.stop()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function toggle() {
    if (status === 'listening') stop()
    else if (status === 'idle') void start()
  }

  return { status, interim, error, toggle, clearError: () => setError(null) }
}

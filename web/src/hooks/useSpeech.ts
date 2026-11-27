import { useEffect, useRef, useState } from 'react'

type SpeechStatus = 'idle' | 'requesting' | 'listening' | 'transcribing'

type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean }

type SpeechRecognizer = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort?: () => void
  onaudiostart: (() => void) | null
  onstart: (() => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechCtor = new () => SpeechRecognizer

function recognitionCtor(): SpeechCtor | null {
  const candidate = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
}

function release(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function micErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return 'The microphone only works on localhost or a secure https page.'
  }
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was blocked. Choose Allow when the browser asks, or enable the microphone for this site in the address bar, then press Listen again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The microphone is busy in another app. Close that app and press Listen again.'
  }
  if (name === 'SecurityError' || name === 'TypeError') {
    return 'This browser blocked microphone access. Open the archive on localhost or https and allow the microphone.'
  }
  return 'The microphone could not be started.'
}

function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new DOMException('Microphone API missing', 'SecurityError'))
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  })
}

export function useSpeech(onFinal: (text: string) => void) {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognizer | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  useEffect(() => () => {
    sessionRef.current += 1
    try {
      recognitionRef.current?.abort?.()
    } catch {
      recognitionRef.current?.stop()
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    release(streamRef.current)
  }, [])

  function beginRecorder(stream: MediaStream, session: number) {
    if (sessionRef.current !== session) {
      release(stream)
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      release(stream)
      setError('This browser cannot record audio.')
      setStatus('idle')
      return
    }
    streamRef.current = stream
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      release(stream)
      if (streamRef.current === stream) streamRef.current = null
      if (sessionRef.current !== session) return
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      if (blob.size === 0) {
        setStatus('idle')
        return
      }
      setStatus('transcribing')
      setInterim('')
      const type = blob.type || 'audio/webm'
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
      void transcribe(blob, `speech.${extension}`, session)
    }
    recorderRef.current = recorder
    recorder.start()
    setStatus('listening')
    setError(null)
  }

  async function transcribe(blob: Blob, filename: string, session: number) {
    try {
      const form = new FormData()
      form.append('file', blob, filename)
      const response = await fetch('/api/transcribe', { method: 'POST', body: form })
      const body = await response.json().catch(() => ({})) as { error?: string; text?: string }
      if (sessionRef.current !== session) return
      if (!response.ok) setError(body.error || 'Transcription failed')
      else if (body.text?.trim()) onFinalRef.current(body.text.trim())
      else setError('No speech was heard. Try again.')
    } catch (caught) {
      if (sessionRef.current !== session) return
      setError(caught instanceof Error ? caught.message : 'Transcription failed')
    } finally {
      if (sessionRef.current === session) setStatus('idle')
    }
  }

  function handoffToRecorder(session: number) {
    const live = streamRef.current
    if (live && live.getTracks().some((track) => track.readyState === 'live')) {
      beginRecorder(live, session)
      return
    }
    void requestMicrophone().then(
      (stream) => beginRecorder(stream, session),
      (caught) => {
        if (sessionRef.current !== session) return
        setError(micErrorMessage(caught))
        setStatus('idle')
      },
    )
  }

  function beginNative(Ctor: SpeechCtor, session: number) {
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    let handedOff = false
    const markLive = () => {
      if (sessionRef.current !== session || handedOff) return
      setStatus('listening')
      setError(null)
    }
    recognition.onstart = markLive
    recognition.onaudiostart = markLive
    recognition.onresult = (event) => {
      if (sessionRef.current !== session) return
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
      if (sessionRef.current !== session || handedOff) return
      if (event.error === 'aborted') return
      if (event.error === 'no-speech') {
        setError('No speech was heard. Try again.')
        setStatus('idle')
        return
      }
      if (event.error === 'audio-capture') {
        setError('The microphone could not be opened.')
        setStatus('idle')
        return
      }
      handedOff = true
      setStatus('requesting')
      try {
        recognition.stop()
      } catch {
        // Recognition already ended; the recorder still gets the microphone.
      }
      handoffToRecorder(session)
    }
    recognition.onend = () => {
      if (handedOff || sessionRef.current !== session) return
      if (recorderRef.current?.state === 'recording') return
      setStatus((current) => (current === 'transcribing' ? current : 'idle'))
      setInterim('')
    }
    recognitionRef.current = recognition
    recognition.start()
    markLive()
  }

  async function start() {
    const session = sessionRef.current + 1
    sessionRef.current = session
    setError(null)
    setInterim('')
    setStatus('requesting')

    let stream: MediaStream
    try {
      stream = await requestMicrophone()
    } catch (caught) {
      if (sessionRef.current !== session) return
      setError(micErrorMessage(caught))
      setStatus('idle')
      return
    }
    if (sessionRef.current !== session) {
      release(stream)
      return
    }

    const Ctor = recognitionCtor()
    if (!Ctor) {
      beginRecorder(stream, session)
      return
    }

    // The grant is what we needed. Speech recognition opens the microphone itself.
    release(stream)
    streamRef.current = null
    try {
      beginNative(Ctor, session)
    } catch {
      try {
        const again = await requestMicrophone()
        if (sessionRef.current !== session) {
          release(again)
          return
        }
        beginRecorder(again, session)
      } catch (caught) {
        if (sessionRef.current !== session) return
        setError(micErrorMessage(caught))
        setStatus('idle')
      }
    }
  }

  function stop() {
    sessionRef.current += 1
    const recognition = recognitionRef.current
    recognitionRef.current = null
    try {
      if (recognition?.abort) recognition.abort()
      else recognition?.stop()
    } catch {
      // The session is already over.
    }
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state === 'recording') {
      recorder.ondataavailable = null
      recorder.onstop = () => {
        release(streamRef.current)
        streamRef.current = null
      }
      recorder.stop()
    } else {
      release(streamRef.current)
      streamRef.current = null
    }
    setStatus('idle')
    setInterim('')
  }

  function toggle() {
    if (status === 'transcribing') return
    if (status === 'listening' || status === 'requesting') stop()
    else void start()
  }

  return { status, interim, error, toggle, clearError: () => setError(null) }
}

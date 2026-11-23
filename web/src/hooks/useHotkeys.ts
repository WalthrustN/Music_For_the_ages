import { useEffect, useRef } from 'react'

type Handlers = {
  onYear: (delta: number) => void
  onGenre: (delta: number) => void
  onSearch: () => void
  onMic: () => void
  onHeatmap: () => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useHotkeys(handlers: Handlers): void {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        latest.current.onYear(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        latest.current.onYear(-1)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        latest.current.onGenre(1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        latest.current.onGenre(-1)
      } else if (event.key === '/') {
        event.preventDefault()
        latest.current.onSearch()
      } else if (event.key === 'h' || event.key === 'H') {
        latest.current.onHeatmap()
      } else if (event.key === 'm' || event.key === 'M') {
        latest.current.onMic()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/

export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (VIDEO_ID.test(trimmed)) return trimmed
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return VIDEO_ID.test(id) ? id : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v')
    if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery
    const parts = url.pathname.split('/').filter(Boolean)
    const slot = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live' || part === 'v')
    const id = slot >= 0 ? parts[slot + 1] ?? '' : ''
    return VIDEO_ID.test(id) ? id : null
  }
  return null
}

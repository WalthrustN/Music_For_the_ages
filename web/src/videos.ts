import map from './video-map.json'

export type VideoClip = {
  mp4: string
  webm?: string
  poster: string
  label: string
}

const clips = map as Record<string, { file: string; label: string }>

export function videoFor(slug: string): VideoClip {
  const key = clips[slug] ? slug : 'default'
  const clip = clips[key]
  return {
    mp4: `/videos/${key}.mp4`,
    poster: `/videos/${key}.svg`,
    label: clip.label,
  }
}

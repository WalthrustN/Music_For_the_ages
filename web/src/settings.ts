export const PANEL_ALPHA_MIN = 0.2
export const PANEL_ALPHA_MAX = 0.9
export const PANEL_BLUR_MIN = 0
export const PANEL_BLUR_MAX = 40
export const PANEL_BLUR_DEFAULT = 24
export const PANEL_TONE_MIN = 0
export const PANEL_TONE_MAX = 200
export const PANEL_TONE_DEFAULT = 100
export const PANEL_GRAYSCALE_MIN = 0
export const PANEL_GRAYSCALE_MAX = 100
export const PANEL_GRAYSCALE_DEFAULT = 0

export type PlayerSide = 'left' | 'right'

export type ArchiveSettings = {
  panelAlpha: number
  panelBlur: number
  panelBrightness: number
  panelContrast: number
  panelSaturate: number
  panelGrayscale: number
  playerSide: PlayerSide
  playerCollapsed: boolean
}

export const DEFAULT_SETTINGS: ArchiveSettings = {
  panelAlpha: 0.5,
  panelBlur: PANEL_BLUR_DEFAULT,
  panelBrightness: PANEL_TONE_DEFAULT,
  panelContrast: PANEL_TONE_DEFAULT,
  panelSaturate: PANEL_TONE_DEFAULT,
  panelGrayscale: PANEL_GRAYSCALE_DEFAULT,
  playerSide: 'right',
  playerCollapsed: false,
}

function clampSetting(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, number))
}

const STORAGE_KEY = 'music-for-the-ages-settings'

export function readSettings(): ArchiveSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ArchiveSettings>
    return {
      panelAlpha: clampSetting(parsed.panelAlpha, DEFAULT_SETTINGS.panelAlpha, PANEL_ALPHA_MIN, PANEL_ALPHA_MAX),
      panelBlur: clampSetting(parsed.panelBlur, DEFAULT_SETTINGS.panelBlur, PANEL_BLUR_MIN, PANEL_BLUR_MAX),
      panelBrightness: clampSetting(parsed.panelBrightness, DEFAULT_SETTINGS.panelBrightness, PANEL_TONE_MIN, PANEL_TONE_MAX),
      panelContrast: clampSetting(parsed.panelContrast, DEFAULT_SETTINGS.panelContrast, PANEL_TONE_MIN, PANEL_TONE_MAX),
      panelSaturate: clampSetting(parsed.panelSaturate, DEFAULT_SETTINGS.panelSaturate, PANEL_TONE_MIN, PANEL_TONE_MAX),
      panelGrayscale: clampSetting(parsed.panelGrayscale, DEFAULT_SETTINGS.panelGrayscale, PANEL_GRAYSCALE_MIN, PANEL_GRAYSCALE_MAX),
      playerSide: parsed.playerSide === 'left' ? 'left' : 'right',
      playerCollapsed: parsed.playerCollapsed === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function writeSettings(settings: ArchiveSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

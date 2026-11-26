export const PANEL_ALPHA_MIN = 0.2
export const PANEL_ALPHA_MAX = 0.9

export type PlayerSide = 'left' | 'right'

export type ArchiveSettings = {
  panelAlpha: number
  playerSide: PlayerSide
  playerCollapsed: boolean
}

export const DEFAULT_SETTINGS: ArchiveSettings = {
  panelAlpha: 0.5,
  playerSide: 'right',
  playerCollapsed: false,
}

const STORAGE_KEY = 'music-for-the-ages-settings'

export function readSettings(): ArchiveSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ArchiveSettings>
    const alpha = typeof parsed.panelAlpha === 'number' ? parsed.panelAlpha : DEFAULT_SETTINGS.panelAlpha
    return {
      panelAlpha: Math.min(PANEL_ALPHA_MAX, Math.max(PANEL_ALPHA_MIN, alpha)),
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

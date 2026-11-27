import { useEffect, useState } from 'react'
import { readSettings, writeSettings, type ArchiveSettings } from '../settings'

export function useSettings() {
  const [settings, setSettings] = useState<ArchiveSettings>(readSettings)

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--panel-alpha', String(settings.panelAlpha))
    root.setProperty('--panel-blur', `${settings.panelBlur}px`)
    root.setProperty('--panel-brightness', `${settings.panelBrightness}%`)
    root.setProperty('--panel-contrast', `${settings.panelContrast}%`)
    root.setProperty('--panel-saturate', `${settings.panelSaturate}%`)
    root.setProperty('--panel-grayscale', `${settings.panelGrayscale}%`)
    writeSettings(settings)
  }, [settings])

  function update(patch: Partial<ArchiveSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  return { settings, update }
}

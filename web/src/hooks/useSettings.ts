import { useEffect, useState } from 'react'
import { readSettings, writeSettings, type ArchiveSettings } from '../settings'

export function useSettings() {
  const [settings, setSettings] = useState<ArchiveSettings>(readSettings)

  useEffect(() => {
    document.documentElement.style.setProperty('--panel-alpha', String(settings.panelAlpha))
    writeSettings(settings)
  }, [settings])

  function update(patch: Partial<ArchiveSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  return { settings, update }
}

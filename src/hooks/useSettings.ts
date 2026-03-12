import { useState, useEffect } from 'react'

export interface Settings {
  soundMentions: boolean
  soundPm: boolean
  desktopNotifications: boolean
}

const DEFAULTS: Settings = {
  soundMentions: true,
  soundPm: true,
  desktopNotifications: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem('chat-settings')
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    localStorage.setItem('chat-settings', JSON.stringify(settings))
  }, [settings])

  function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return { settings, setSetting }
}

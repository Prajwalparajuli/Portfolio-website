export const ACCENT_STORAGE_KEY = 'portfolio-accent'

export const ACCENT_PRESETS: Record<string, { hue: number; label: string }> = {
  blue: { hue: 217, label: 'Blue' },
  purple: { hue: 262, label: 'Purple' },
  green: { hue: 142, label: 'Green' },
  amber: { hue: 38, label: 'Amber' },
  rose: { hue: 350, label: 'Rose' },
}

const DEFAULT_HUE = 217

export function getStoredAccentHue(): number {
  if (typeof window === 'undefined') return DEFAULT_HUE
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
  if (!stored) return DEFAULT_HUE
  const preset = ACCENT_PRESETS[stored]
  return preset ? preset.hue : DEFAULT_HUE
}

export function setStoredAccent(presetKey: string | null): void {
  if (typeof window === 'undefined') return
  if (presetKey === null) {
    localStorage.removeItem(ACCENT_STORAGE_KEY)
    document.documentElement.style.setProperty('--accent-hue', String(DEFAULT_HUE))
    return
  }
  localStorage.setItem(ACCENT_STORAGE_KEY, presetKey)
  const preset = ACCENT_PRESETS[presetKey]
  if (preset) {
    document.documentElement.style.setProperty('--accent-hue', String(preset.hue))
  }
}

export function applyStoredAccent(): void {
  const hue = getStoredAccentHue()
  document.documentElement.style.setProperty('--accent-hue', String(hue))
}

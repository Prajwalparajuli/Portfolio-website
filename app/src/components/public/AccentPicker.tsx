import { useState, useEffect } from 'react'
import { Palette } from 'lucide-react'
import { ACCENT_PRESETS, ACCENT_STORAGE_KEY, getStoredAccentHue, setStoredAccent, applyStoredAccent } from '@/lib/accent'
import { cn } from '@/lib/utils'

export function AccentPicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [currentKey, setCurrentKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ACCENT_STORAGE_KEY)
  })

  useEffect(() => {
    applyStoredAccent()
  }, [])

  const handleSelect = (key: string) => {
    const next = currentKey === key ? null : key
    setStoredAccent(next)
    setCurrentKey(next)
    setOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-3 rounded-xl transition-colors dock-item-inner backdrop-blur-md"
        title="Accent color"
      >
        <Palette className="h-5 w-5 text-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl glass-strong border border-border flex flex-col gap-1.5 z-50">
            <span className="text-xs text-muted-foreground font-medium">Accent</span>
            <div className="flex items-center gap-2">
              {Object.entries(ACCENT_PRESETS).map(([key, { hue, label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(key)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                    currentKey === key ? 'border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground/30' : 'border-transparent'
                  )}
                  style={{ backgroundColor: `hsl(${hue}, 70%, 55%)` }}
                  title={label}
                />
              ))}
            </div>
            {currentKey && (
              <button
                type="button"
                onClick={() => { setStoredAccent(null); setCurrentKey(null); setOpen(false); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

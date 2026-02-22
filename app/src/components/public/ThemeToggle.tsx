import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'portfolio-theme'

export function ThemeToggle({ className }: { className?: string }) {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light'))
  }, [])

  const toggle = () => {
    const next = !document.documentElement.classList.contains('light')
    if (next) {
      document.documentElement.classList.add('light')
      localStorage.setItem(STORAGE_KEY, 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem(STORAGE_KEY, 'dark')
    }
    setIsLight(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'p-3 rounded-xl transition-colors dock-item-inner backdrop-blur-md',
        className
      )}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLight ? <Moon className="h-5 w-5 text-foreground" /> : <Sun className="h-5 w-5 text-foreground" />}
    </button>
  )
}

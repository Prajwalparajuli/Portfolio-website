import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { Mail, ArrowDown } from 'lucide-react'

interface HeroSectionProps {
  settings: PortfolioSettings
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'

function useTextScramble(target: string, duration = 1500) {
  const [display, setDisplay] = useState('')
  const [done, setDone] = useState(false)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!target) { setDisplay(''); setDone(true); return }
    setDone(false)
    const len = target.length
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const revealed = Math.floor(progress * len)
      let result = ''
      for (let i = 0; i < len; i++) {
        if (target[i] === ' ') { result += ' '; continue }
        result += i < revealed ? target[i] : CHARS[Math.floor(Math.random() * CHARS.length)]
      }
      setDisplay(result)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(target)
        setDone(true)
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return { display, done }
}

export function HeroSection({ settings }: HeroSectionProps) {
  const { display: scrambledTitle, done: scrambleDone } = useTextScramble(settings.site_title, 1800)
  const orbRef = useRef<HTMLDivElement>(null)
  const orbPos = useRef({ x: 0, y: 0 })
  const orbTarget = useRef({ x: 0, y: 0 })
  const rafRef = useRef(0)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  useEffect(() => {
    const tick = () => {
      orbPos.current.x = lerp(orbPos.current.x, orbTarget.current.x, 0.08)
      orbPos.current.y = lerp(orbPos.current.y, orbTarget.current.y, 0.08)
      if (orbRef.current) {
        orbRef.current.style.transform = `translate3d(${orbPos.current.x - 200}px, ${orbPos.current.y - 200}px, 0)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    orbTarget.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  return (
    <section
      onMouseMove={handleMouseMove}
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Mouse-reactive gradient orb */}
      <div
        ref={orbRef}
        className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none will-change-transform"
        style={{
          background: 'radial-gradient(circle, hsla(var(--accent-hue), var(--accent-saturation), var(--accent-lightness), 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-4xl mx-auto relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6 flex flex-col items-center gap-2"
        >
          <span className="inline-block px-4 py-2 rounded-full glass text-sm text-muted-foreground font-mono">
            {settings.site_description}
          </span>
          {settings.now_line?.trim() && (
            <span className="text-sm text-muted-foreground/90 font-medium">
              {settings.now_line.trim()}
            </span>
          )}
          {settings.location?.trim() && (
            <span className="text-sm text-muted-foreground/80 font-mono">
              Based in {settings.location.trim()}
            </span>
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
        >
          <span className={scrambleDone ? 'gradient-text-accent' : 'font-mono gradient-text-accent'}>
            {scrambledTitle}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          {settings.bio}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex items-center justify-center gap-4"
        >
          <a
            href={`mailto:${settings.contact_email}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            <Mail className="h-4 w-4" />
            Get in Touch
          </a>
          {settings.resume_url && (
            <a
              href={settings.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass font-medium hover:opacity-90 transition-opacity text-foreground"
            >
              View Resume
            </a>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2 text-muted-foreground"
        >
          <span className="text-sm font-mono">Scroll to explore</span>
          <ArrowDown className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </section>
  )
}

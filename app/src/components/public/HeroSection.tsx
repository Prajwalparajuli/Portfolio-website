import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { Mail, ArrowDown } from 'lucide-react'

interface HeroSectionProps {
  settings: PortfolioSettings
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'

function useTextScramble(target: string, duration = 1500, delay = 0) {
  const [display, setDisplay] = useState('')
  const [done, setDone] = useState(false)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!target) { setDisplay(''); setDone(true); return }
    
    const timeout = setTimeout(() => {
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
    }, delay)
    
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, delay])

  return { display, done }
}

// Magnetic button effect
function MagneticButton({ children, href, className, external = false }: {
  children: React.ReactNode
  href: string
  className?: string
  external?: boolean
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distX = (e.clientX - centerX) * 0.15
    const distY = (e.clientY - centerY) * 0.15
    setPosition({ x: distX, y: distY })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 })
  }, [])

  const Component = external ? 'a' : motion.a
  const props = external 
    ? { href, target: '_blank', rel: 'noopener noreferrer' } 
    : { href }

  return (
    <Component
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  )
}

function TextReveal({ children, delay = 0, className }: {
  children: string
  delay?: number
  className?: string
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 40, clipPath: 'inset(100% 0 0 0)' }}
      animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0 0)' }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.span>
  )
}

// Abstract Constellation Background - lightweight
function ConstellationBackground({ scrollProgress }: { scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  // Generate static nodes
  const nodes = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: 15 + (i % 5) * 15 + Math.random() * 5,
      y: 20 + Math.floor(i / 5) * 15 + Math.random() * 5,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 1.5,
      layer: Math.random() > 0.6 ? 'front' : 'back',
    }))
  }, [])

  // Pre-calculate connections
  const connections = useMemo(() => {
    const conns: { from: number; to: number }[] = []
    nodes.forEach((node, i) => {
      nodes.forEach((other, j) => {
        if (i >= j) return
        const dist = Math.sqrt(
          Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2)
        )
        if (dist < 20 && Math.random() > 0.4) {
          conns.push({ from: i, to: j })
        }
      })
    })
    return conns
  }, [nodes])

  const yParallax = useTransform(scrollProgress, [0, 1], [0, -60])
  const springY = useSpring(yParallax, { stiffness: 30, damping: 20 })

  return (
    <motion.div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ y: springY }}>
      <svg className="w-full h-full" preserveAspectRatio="none">
        {/* Connection lines */}
        {connections.map((conn, i) => {
          const from = nodes[conn.from]
          const to = nodes[conn.to]
          return (
            <motion.line
              key={`line-${i}`}
              x1={`${from.x}%`}
              y1={`${from.y}%`}
              x2={`${to.x}%`}
              y2={`${to.y}%`}
              stroke="hsla(var(--accent-hue), var(--accent-saturation), var(--accent-lightness), 0.12)"
              strokeWidth="0.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.25 }}
              transition={{ duration: 1.5, delay: from.delay * 0.5, ease: "easeOut" }}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <motion.circle
            key={`node-${node.id}`}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r={node.size}
            fill={node.layer === 'front' ? 'hsla(var(--accent-hue), 70%, 60%, 0.5)' : 'hsla(var(--accent-hue), 50%, 50%, 0.25)'}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: node.delay * 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          />
        ))}
      </svg>
    </motion.div>
  )
}

// Flowing Data Particles - reduced count
function DataFlow({ scrollProgress }: { scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      startX: 15 + i * 10,
      delay: i * 0.8,
      duration: 10 + Math.random() * 4,
    }))
  }, [])

  const yOffset = useTransform(scrollProgress, [0, 1], [0, -30])
  const springY = useSpring(yOffset, { stiffness: 40, damping: 25 })

  return (
    <motion.div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ y: springY }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full bg-accent/20"
          style={{
            left: `${p.startX}%`,
            bottom: '-20px',
          }}
          animate={{
            y: [0, -1200],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </motion.div>
  )
}

export function HeroSection({ settings }: HeroSectionProps) {
  const { display: scrambledTitle, done: scrambleDone } = useTextScramble(settings.site_title, 1800, 400)
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  return (
    <section ref={containerRef} className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Lightweight abstract background */}
      <div className="absolute inset-0 overflow-hidden">
        <ConstellationBackground scrollProgress={scrollYProgress} />
        <DataFlow scrollProgress={scrollYProgress} />
      </div>

      <div className="text-center max-w-4xl mx-auto relative z-10">
        {/* Main heading with text reveal animation */}
        <h1 className="font-display font-semibold text-6xl sm:text-7xl lg:text-8xl xl:text-9xl tracking-tight mb-8 text-foreground">
          <TextReveal delay={0.2} className={scrambleDone ? '' : 'font-mono'}>
            {scrambledTitle}
          </TextReveal>
        </h1>

        {/* Meaningful tagline instead of generic bio */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
            Turning complex data into actionable insights. I build machine learning systems 
            that help businesses make smarter decisions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground/70 font-mono">
            <span>Machine Learning</span>
            <span className="w-1 h-1 rounded-full bg-accent/50" />
            <span>Data Engineering</span>
            <span className="w-1 h-1 rounded-full bg-accent/50" />
            <span>Statistical Analysis</span>
          </div>
        </motion.div>

        {/* CTA Buttons with magnetic hover effect */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <MagneticButton
            href={`mailto:${settings.contact_email}`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-foreground text-background font-medium hover:opacity-90 transition-opacity group"
          >
            <Mail className="h-4 w-4 transition-transform group-hover:scale-110" />
            Get in Touch
          </MagneticButton>
          
          {settings.resume_url && (
            <MagneticButton
              href={settings.resume_url}
              external
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full glass font-medium hover:glass-strong transition-all text-foreground group"
            >
              <span className="relative">
                View Resume
                <span className="absolute bottom-0 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
              </span>
            </MagneticButton>
          )}
        </motion.div>
      </div>

      {/* Scroll indicator with bounce animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2 text-muted-foreground/70"
        >
          <span className="text-xs font-mono uppercase tracking-widest">Scroll</span>
          <ArrowDown className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </section>
  )
}

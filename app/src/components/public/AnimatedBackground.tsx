import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion'
import { useRef, useMemo, useEffect, useCallback } from 'react'

// Star field with twinkling
function StarField() {
  const stars = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 5,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

// Floating nebula clouds
function NebulaCloud({ 
  size, 
  color, 
  x, 
  y, 
  duration, 
  delay,
  scrollProgress,
  parallaxSpeed = 0.3 
}: { 
  size: number
  color: string
  x: string
  y: string
  duration: number
  delay: number
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"]
  parallaxSpeed?: number
}) {
  const yParallax = useTransform(scrollProgress, [0, 1], [0, 200 * parallaxSpeed])
  const springY = useSpring(yParallax, { stiffness: 30, damping: 20 })

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        filter: `blur(${size * 0.25}px)`,
        left: x,
        top: y,
        y: springY,
        opacity: 0.3,
      }}
      animate={{
        scale: [1, 1.1, 1],
        x: [0, 20, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

// Constellation lines that connect nearby nodes
function Constellation({ scrollProgress }: { scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const nodes = useMemo(() => {
    return [
      { x: 15, y: 20 }, { x: 25, y: 15 }, { x: 20, y: 30 },
      { x: 70, y: 25 }, { x: 80, y: 35 }, { x: 75, y: 15 },
      { x: 40, y: 60 }, { x: 50, y: 55 }, { x: 45, y: 70 },
      { x: 85, y: 70 }, { x: 90, y: 60 },
    ]
  }, [])

  const y = useTransform(scrollProgress, [0, 1], [0, -50])
  const springY = useSpring(y, { stiffness: 40, damping: 25 })

  return (
    <motion.svg 
      className="absolute inset-0 w-full h-full pointer-events-none opacity-20" 
      style={{ y: springY }}
    >
      {nodes.map((node, i) => 
        nodes.slice(i + 1).map((other, j) => {
          const dist = Math.sqrt(
            Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2)
          )
          if (dist > 30) return null
          return (
            <motion.line
              key={`${i}-${j}`}
              x1={`${node.x}%`}
              y1={`${node.y}%`}
              x2={`${other.x}%`}
              y2={`${other.y}%`}
              stroke="hsla(var(--accent-hue), var(--accent-saturation), var(--accent-lightness), 0.3)"
              strokeWidth="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: i * 0.1 }}
            />
          )
        })
      )}
      {nodes.map((node, i) => (
        <motion.circle
          key={i}
          cx={`${node.x}%`}
          cy={`${node.y}%`}
          r="3"
          fill="hsla(var(--accent-hue), var(--accent-saturation), var(--accent-lightness), 0.5)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        />
      ))}
    </motion.svg>
  )
}

// Particle stream flowing upward
function ParticleStream({ scrollProgress }: { scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      startX: 10 + (i % 5) * 20,
      delay: i * 0.5,
      duration: 8 + Math.random() * 4,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full bg-accent/40"
          style={{
            left: `${p.startX}%`,
            bottom: '-20px',
          }}
          animate={{
            y: [0, -1200],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  )
}

// Mouse-following glow effect
function MouseGlow() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rafRef = useRef<number>(0)
  const isActiveRef = useRef(true)

  const updateMouse = useCallback((e: MouseEvent) => {
    if (!isActiveRef.current) return
    mouseX.set(e.clientX)
    mouseY.set(e.clientY)
  }, [mouseX, mouseY])

  useEffect(() => {
    // Check for touch device
    if (window.matchMedia('(pointer: coarse)').matches) return

    const throttledUpdate = (e: MouseEvent) => {
      if (!isActiveRef.current) return
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => updateMouse(e))
    }

    window.addEventListener('mousemove', throttledUpdate, { passive: true })
    
    return () => {
      isActiveRef.current = false
      window.removeEventListener('mousemove', throttledUpdate)
      cancelAnimationFrame(rafRef.current)
    }
  }, [updateMouse])

  // Spring-smoothed values
  const springX = useSpring(mouseX, { stiffness: 30, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 30, damping: 20 })

  return (
    <motion.div
      className="fixed w-[600px] h-[600px] rounded-full pointer-events-none z-0"
      style={{
        background: 'radial-gradient(circle, hsla(var(--accent-hue), 60%, 50%, 0.08) 0%, transparent 60%)',
        filter: 'blur(80px)',
        x: springX,
        y: springY,
        translateX: '-50%',
        translateY: '-50%',
      }}
    />
  )
}

export function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden">
      {/* Base dark background */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Star field */}
      <StarField />
      
      {/* Nebula clouds with parallax */}
      <NebulaCloud
        size={400}
        color="radial-gradient(circle, hsla(var(--accent-hue), 70%, 50%, 0.4) 0%, transparent 60%)"
        x="5%"
        y="10%"
        duration={20}
        delay={0}
        scrollProgress={scrollYProgress}
        parallaxSpeed={0.2}
      />
      <NebulaCloud
        size={350}
        color="radial-gradient(circle, hsla(calc(var(--accent-hue) + 40), 60%, 45%, 0.3) 0%, transparent 60%)"
        x="70%"
        y="50%"
        duration={25}
        delay={5}
        scrollProgress={scrollYProgress}
        parallaxSpeed={0.3}
      />
      <NebulaCloud
        size={300}
        color="radial-gradient(circle, hsla(var(--accent-hue), 80%, 55%, 0.35) 0%, transparent 60%)"
        x="60%"
        y="5%"
        duration={18}
        delay={2}
        scrollProgress={scrollYProgress}
        parallaxSpeed={0.4}
      />
      <NebulaCloud
        size={250}
        color="radial-gradient(circle, hsla(calc(var(--accent-hue) - 30), 50%, 50%, 0.25) 0%, transparent 60%)"
        x="20%"
        y="60%"
        duration={22}
        delay={8}
        scrollProgress={scrollYProgress}
        parallaxSpeed={0.35}
      />
      
      {/* Constellation network */}
      <Constellation scrollProgress={scrollYProgress} />
      
      {/* Particle streams */}
      <ParticleStream scrollProgress={scrollYProgress} />
      
      {/* Mouse-following glow */}
      <MouseGlow />
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  )
}

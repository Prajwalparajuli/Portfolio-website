import { motion, useScroll, useSpring, useTransform } from 'framer-motion'

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { 
    stiffness: 100, 
    damping: 30, 
    restDelta: 0.001 
  })
  
  // Gradient position based on scroll
  const gradientPosition = useTransform(
    scrollYProgress,
    [0, 1],
    ['0%', '100%']
  )

  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[60] origin-left no-print overflow-hidden">
      <motion.div
        className="h-full w-full"
        style={{
          scaleX,
          background: `linear-gradient(
            90deg, 
            hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 10%)),
            hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness)),
            hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 15%))
          )`,
          backgroundSize: '200% 100%',
        }}
      />
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 h-full"
        style={{
          scaleX,
          background: `linear-gradient(
            90deg, 
            hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 10%)),
            hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness)),
            hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 15%))
          )`,
          filter: 'blur(4px)',
          opacity: 0.5,
        }}
      />
    </div>
  )
}
